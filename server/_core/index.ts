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
  // One-off maintenance: point an existing SOP at a different Google Doc (e.g.
  // swap a not-owned source doc for an owned copy) without losing module links.
  app.post("/api/admin/repoint-sop", async (req, res) => {
    const secret = process.env.SETUP_SECRET;
    if (!secret || req.headers["x-setup-secret"] !== secret) {
      return res.status(404).json({ error: "Not found" });
    }
    try {
      const { oldDocId, newDocId, title } = req.body ?? {};
      if (!oldDocId || !newDocId || !title) {
        return res.status(400).json({ error: "oldDocId, newDocId and title are required" });
      }
      const db = await import("../db");
      const { fetchGoogleDocText } = await import("../googleDrive");
      const sop = await db.getSopByGoogleDocId(oldDocId);
      if (!sop) return res.status(404).json({ error: "No SOP found for oldDocId" });
      const content = await fetchGoogleDocText(newDocId);
      await db.repointSop(sop.id, { googleDocId: newDocId, title, content });
      res.json({ ok: true, sopId: sop.id, title, from: oldDocId, to: newDocId });
    } catch (e: any) {
      console.error("[RepointSop] error:", e);
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
  // One-off maintenance: build weekly test-out milestones (and their graded
  // skill modules) into a track, plus optional regular training modules. Gated
  // by the SETUP_SECRET header. Dry run when apply=false (reports current track
  // structure + the plan without writing). Idempotent on re-apply.
  app.post("/api/admin/build-testouts", async (req, res) => {
    const secret = process.env.SETUP_SECRET;
    if (!secret || req.headers["x-setup-secret"] !== secret) {
      return res.status(404).json({ error: "Not found" });
    }
    try {
      const { teamRole, weeks, trainingModules, apply } = req.body ?? {};
      if (!teamRole || !Array.isArray(weeks)) {
        return res.status(400).json({ error: "teamRole and weeks[] are required" });
      }
      const { runBuildTestOuts } = await import("../buildTestOuts");
      const result = await runBuildTestOuts({
        teamRole,
        weeks,
        trainingModules: Array.isArray(trainingModules) ? trainingModules : [],
        apply: !!apply,
      });
      res.json({ ok: true, ...result });
    } catch (e: any) {
      console.error("[BuildTestOuts] error:", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });
  // One-off maintenance: link an EXISTING SOP to modules by title match. Gated
  // by the SETUP_SECRET header. Dry run when apply=false. Idempotent (skips
  // modules already linked to the SOP). Refuses to apply if the SOP match is
  // ambiguous — pass sopId to disambiguate.
  app.post("/api/admin/link-sop", async (req, res) => {
    const secret = process.env.SETUP_SECRET;
    if (!secret || req.headers["x-setup-secret"] !== secret) {
      return res.status(404).json({ error: "Not found" });
    }
    try {
      const { sopMatch, sopId, moduleMatch, moduleIds, apply, replace } = req.body ?? {};
      const db = await import("../db");

      // Resolve the SOP.
      const allSops = await db.getAllSops();
      let sop: any;
      if (typeof sopId === "number") {
        sop = allSops.find((s: any) => s.id === sopId);
        if (!sop) return res.status(404).json({ error: `No SOP with id ${sopId}` });
      } else if (typeof sopMatch === "string" && sopMatch.trim()) {
        const m = sopMatch.toLowerCase();
        const matches = allSops.filter((s: any) => (s.title ?? "").toLowerCase().includes(m));
        if (matches.length === 0) {
          return res.status(404).json({ error: `No SOP title contains "${sopMatch}"` });
        }
        if (matches.length > 1) {
          return res.json({
            ok: false,
            ambiguous: true,
            message: "Multiple SOPs match — re-run with sopId to pick one.",
            sopMatches: matches.map((s: any) => ({ id: s.id, title: s.title })),
          });
        }
        sop = matches[0];
      } else {
        return res.status(400).json({ error: "sopMatch (string) or sopId (number) required" });
      }

      // Resolve target modules.
      const allMods = await db.getAllModules();
      let mods: any[];
      if (Array.isArray(moduleIds) && moduleIds.length) {
        const idset = new Set(moduleIds.map((n: any) => Number(n)));
        mods = allMods.filter((mod: any) => idset.has(mod.id));
      } else if (typeof moduleMatch === "string" && moduleMatch.trim()) {
        const mm = moduleMatch.toLowerCase();
        mods = allMods.filter((mod: any) => (mod.title ?? "").toLowerCase().includes(mm));
      } else {
        return res.status(400).json({ error: "moduleMatch (string) or moduleIds (array) required" });
      }

      let linked = 0;
      let unlinked = 0;
      const results: any[] = [];
      for (const mod of mods) {
        const existing = await db.getModuleSops(mod.id);
        const already = existing.some((l: any) => l.id === sop.id);
        // In replace mode, any other SOP currently on this module is removed.
        const toRemove = replace ? existing.filter((l: any) => l.id !== sop.id) : [];

        if (apply) {
          for (const r of toRemove) {
            await db.unlinkModuleFromSop(mod.id, r.id);
            unlinked++;
          }
          if (!already) {
            await db.linkModuleToSop(mod.id, sop.id);
            linked++;
          }
        }

        const status = already
          ? (toRemove.length ? "already linked (removed others)" : "already linked")
          : (apply ? "linked" : "would link");
        results.push({
          id: mod.id,
          title: mod.title,
          milestoneId: mod.milestoneId,
          currentLinks: existing.map((l: any) => ({ id: l.id, title: l.title })),
          removes: toRemove.map((l: any) => ({ id: l.id, title: l.title })),
          status,
        });
      }

      res.json({
        ok: true,
        applied: !!apply,
        replace: !!replace,
        sop: { id: sop.id, title: sop.title },
        matchedModules: mods.length,
        linked,
        unlinked,
        modules: results,
      });
    } catch (e: any) {
      console.error("[LinkSop] error:", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });
  // One-off maintenance: list or delete Learning Library rows. Gated by the
  // SETUP_SECRET header. Used to remove stale entries the sync won't prune
  // (a video removed from Drive leaves an orphaned row). Dry run when apply=false.
  app.post("/api/admin/library-maintenance", async (req, res) => {
    const secret = process.env.SETUP_SECRET;
    if (!secret || req.headers["x-setup-secret"] !== secret) {
      return res.status(404).json({ error: "Not found" });
    }
    try {
      const { action, id, match, apply } = req.body ?? {};
      const db = await import("../db");
      const all = await db.getLibraryVideos();
      if (action === "list") {
        return res.json({
          ok: true,
          count: all.length,
          videos: all.map((v: any) => ({ id: v.id, name: v.name, category: v.category, driveFileId: v.driveFileId })),
        });
      }
      if (action === "delete") {
        let matched: any[];
        if (typeof id === "number") {
          matched = all.filter((v: any) => v.id === id);
        } else if (typeof match === "string" && match.trim()) {
          const m = match.toLowerCase();
          matched = all.filter((v: any) => (v.name ?? "").toLowerCase().includes(m));
        } else {
          return res.status(400).json({ error: "delete requires id (number) or match (string)" });
        }
        let deleted = 0;
        if (apply) {
          for (const v of matched) {
            await db.deleteLibraryVideoById(v.id);
            deleted++;
          }
        }
        return res.json({
          ok: true,
          applied: !!apply,
          deleted,
          matchedCount: matched.length,
          matched: matched.map((v: any) => ({ id: v.id, name: v.name, category: v.category, driveFileId: v.driveFileId })),
        });
      }
      return res.status(400).json({ error: "action must be 'list' or 'delete'" });
    } catch (e: any) {
      console.error("[LibraryMaintenance] error:", e);
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
