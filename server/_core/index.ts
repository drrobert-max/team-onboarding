import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import multer from "multer";
import cron from "node-cron";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { scheduledSopSyncHandler } from "../scheduledSopSync";
import { syncLibraryVideos } from "../scheduledLibrarySync";
import { storagePut } from "../storage";
import { ENV } from "./env";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Optionally apply DB migrations on boot (set RUN_MIGRATIONS=true on deploy).
  if ((process.env.RUN_MIGRATIONS ?? "").toLowerCase() === "true") {
    const { runMigrations } = await import("./migrate");
    await runMigrations();
  }

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  // Simple health check for the deployment platform.
  app.get("/healthz", (_req, res) => res.json({ ok: true }));
  // One-time bootstrap: create the first admin account on a fresh database.
  // Requires the SETUP_SECRET env var AND a matching x-setup-secret header,
  // and permanently refuses once any admin exists.
  app.post("/api/setup/first-admin", async (req, res) => {
    try {
      const secret = process.env.SETUP_SECRET;
      if (!secret || req.headers["x-setup-secret"] !== secret) {
        return res.status(404).json({ error: "Not found" });
      }
      const db = await import("../db");
      const all = await db.getAllUsers();
      if (all.some(u => u.role === "admin")) {
        return res.status(409).json({ error: "An admin already exists — endpoint disabled" });
      }
      const { email, password, name } = req.body ?? {};
      if (
        typeof email !== "string" || !email.includes("@") ||
        typeof password !== "string" || password.length < 8
      ) {
        return res.status(400).json({ error: "email and password (min 8 chars) required" });
      }
      const { hashPassword } = await import("../emailAuth");
      const hash = await hashPassword(password);
      const user = await db.createUserWithPassword({
        email: email.toLowerCase().trim(),
        name: typeof name === "string" && name.trim() ? name.trim() : "Admin",
        passwordHash: hash,
        role: "admin",
      });
      console.log(`[Setup] First admin created: ${user?.email}`);
      res.json({ ok: true, id: user?.id, email: user?.email, role: user?.role });
    } catch (e) {
      console.error("[Setup] first-admin error:", e);
      res.status(500).json({ error: String(e) });
    }
  });
  // Scheduled SOP sync endpoint (bi-weekly cron)
  app.post("/api/scheduled/sop-sync", scheduledSopSyncHandler);
  // One-off maintenance: add a Google Doc as an SOP and link it to modules that
  // mention a keyword. Gated by the SETUP_SECRET header (admin/operator only).
  app.post("/api/admin/attach-sop", async (req, res) => {
    const secret = process.env.SETUP_SECRET;
    if (!secret || req.headers["x-setup-secret"] !== secret) {
      return res.status(404).json({ error: "Not found" });
    }
    try {
      const { docId, title, category, keyword, apply } = req.body ?? {};
      if (!docId || !title || !category || !keyword) {
        return res.status(400).json({ error: "docId, title, category and keyword are required" });
      }
      const { runAttachSopToModules } = await import("../attachSop");
      const result = await runAttachSopToModules({ docId, title, category, keyword, apply: !!apply });
      res.json({ ok: true, ...result });
    } catch (e: any) {
      console.error("[AttachSop] error:", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });
  // One-off maintenance: replace the Loom video on every module whose title
  // matches a keyword. Gated by the SETUP_SECRET header. Dry run when apply=false.
  app.post("/api/admin/update-module-loom", async (req, res) => {
    const secret = process.env.SETUP_SECRET;
    if (!secret || req.headers["x-setup-secret"] !== secret) {
      return res.status(404).json({ error: "Not found" });
    }
    try {
      const { keyword, moduleIds, loomUrl, apply } = req.body ?? {};
      if (!loomUrl || (!keyword && !Array.isArray(moduleIds))) {
        return res.status(400).json({ error: "loomUrl and (keyword or moduleIds) are required" });
      }
      const db = await import("../db");
      const loomVideoId = String(loomUrl).split("?")[0].replace(/\/+$/, "").split("/").pop() || "";
      const all = await db.getAllModules();
      let matched: any[];
      if (Array.isArray(moduleIds) && moduleIds.length) {
        const idset = new Set(moduleIds.map((n: any) => Number(n)));
        matched = all.filter((m: any) => idset.has(m.id));
      } else {
        const kw = String(keyword).toLowerCase();
        matched = all.filter((m: any) => (m.title ?? "").toLowerCase().includes(kw));
      }
      let updated = 0;
      if (apply) {
        for (const m of matched) {
          await db.updateModuleLoom(m.id, String(loomUrl), loomVideoId);
          updated++;
        }
      }
      res.json({
        ok: true,
        loomVideoId,
        keyword,
        applied: !!apply,
        updated,
        matchedCount: matched.length,
        matchedModules: matched.map((m: any) => ({ id: m.id, title: m.title, type: m.type, currentLoom: m.loomUrl })),
      });
    } catch (e: any) {
      console.error("[UpdateModuleLoom] error:", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });
  // Scheduled Library sync endpoint (bi-weekly cron)
  app.post("/api/scheduled/library-sync", async (_req, res) => {
    try {
      const result = await syncLibraryVideos();
      res.json({ ok: true, ...result });
    } catch (e) {
      console.error("[LibrarySync] Handler error:", e);
      res.status(500).json({ ok: false, error: String(e) });
    }
  });
  // Server-side video upload endpoint (avoids browser→S3 CORS issues on mobile)
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });
  app.post("/api/upload/video", upload.single("file"), async (req: any, res: any) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file provided" });
      const ext = (req.file.originalname.split(".").pop() ?? "mp4").toLowerCase();
      const contentType = req.file.mimetype || (ext === "mov" ? "video/quicktime" : "video/mp4");
      const key = `submissions/videos/${Date.now()}.${ext}`;
      const { key: finalKey, url: storageUrl } = await storagePut(key, req.file.buffer, contentType);
      res.json({ key: finalKey, storageUrl });
    } catch (e) {
      console.error("[VideoUpload] Server upload error:", e);
      res.status(500).json({ error: String(e) });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Public rollout/deployment guide — clean URL redirects to the static page.
  app.get("/rollout", (_req, res) => res.redirect(302, "/rollout.html"));
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    registerScheduledJobs(port);
  });
}

/**
 * In-process scheduler (replaces the Manus "heartbeat" cron service).
 * Enabled by setting ENABLE_CRON=true. On a single-instance deployment this is
 * the simplest way to keep the weekly Google Drive syncs running. If you scale
 * to multiple instances, disable this and drive the /api/scheduled/* endpoints
 * from an external scheduler (e.g. Railway cron / GitHub Actions) instead.
 */
function registerScheduledJobs(port: number) {
  if (!ENV.enableCron) {
    console.log("[Cron] ENABLE_CRON not set — in-process schedules disabled.");
    return;
  }

  const base = `http://127.0.0.1:${port}`;
  const hit = async (path: string) => {
    try {
      const resp = await fetch(`${base}${path}`, { method: "POST" });
      console.log(`[Cron] ${path} -> ${resp.status}`);
    } catch (e) {
      console.error(`[Cron] ${path} failed:`, e);
    }
  };

  // Every Monday 03:00 UTC — Google Drive library video sync
  cron.schedule("0 3 * * 1", () => hit("/api/scheduled/library-sync"), {
    timezone: "UTC",
  });
  // Every Monday 03:30 UTC — Google Drive SOP sync
  cron.schedule("30 3 * * 1", () => hit("/api/scheduled/sop-sync"), {
    timezone: "UTC",
  });
  console.log("[Cron] Weekly library-sync and sop-sync scheduled (UTC).");
}

startServer().catch(console.error);
