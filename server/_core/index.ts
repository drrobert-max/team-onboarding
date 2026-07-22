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
  // ── One-time Google Drive authorization helper ──────────────────────────────
  // Lets an operator grant the app write access to Drive (to save uploaded
  // videos) without touching the OAuth Playground. Flow:
  //   1. Set GOOGLE_DRIVE_CLIENT_ID/SECRET in Railway (from a Google OAuth client
  //      whose redirect URI is this app's /api/setup/gdrive-callback).
  //   2. Visit /api/setup/gdrive-auth?secret=SETUP_SECRET → Google consent.
  //   3. The callback shows the refresh token to paste as GOOGLE_DRIVE_REFRESH_TOKEN.
  const PUBLIC_URL = (process.env.PUBLIC_URL ?? "https://team-onboarding-production.up.railway.app").replace(/\/+$/, "");
  const GDRIVE_REDIRECT = `${PUBLIC_URL}/api/setup/gdrive-callback`;
  app.get("/api/setup/gdrive-auth", (req, res) => {
    const secret = process.env.SETUP_SECRET;
    if (!secret || req.query.secret !== secret) return res.status(404).send("Not found");
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    if (!clientId) return res.status(400).send("Set GOOGLE_DRIVE_CLIENT_ID in Railway first.");
    const url =
      "https://accounts.google.com/o/oauth2/v2/auth?" +
      new URLSearchParams({
        client_id: clientId,
        redirect_uri: GDRIVE_REDIRECT,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/drive.file",
        access_type: "offline",
        prompt: "consent",
      }).toString();
    res.redirect(url);
  });
  app.get("/api/setup/gdrive-callback", async (req, res) => {
    try {
      const code = req.query.code as string | undefined;
      const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
      if (!code || !clientId || !clientSecret) {
        return res.status(400).send("Missing code or client credentials.");
      }
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code, client_id: clientId, client_secret: clientSecret,
          redirect_uri: GDRIVE_REDIRECT, grant_type: "authorization_code",
        }),
      });
      const data = (await tokenRes.json()) as any;
      if (!data.refresh_token) {
        return res
          .status(400)
          .send(`<p>No refresh token returned. Remove the app's access at myaccount.google.com/permissions and try again.</p><pre>${JSON.stringify(data, null, 2)}</pre>`);
      }
      res.setHeader("content-type", "text/html");
      res.send(
        `<div style="font-family:sans-serif;max-width:640px;margin:40px auto;line-height:1.6">
          <h2 style="color:#2d5016">✅ Google Drive connected</h2>
          <p>Copy this value and add it in Railway as <b>GOOGLE_DRIVE_REFRESH_TOKEN</b>:</p>
          <textarea readonly style="width:100%;height:90px;font-family:monospace;padding:10px">${data.refresh_token}</textarea>
          <p style="color:#666">Then message your setup contact that the token is set — that's the last step.</p>
        </div>`
      );
    } catch (e: any) {
      res.status(500).send("Error: " + e.message);
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
      const { fetchGoogleDocHtml } = await import("../googleDrive");
      const sop = await db.getSopByGoogleDocId(oldDocId);
      if (!sop) return res.status(404).json({ error: "No SOP found for oldDocId" });
      const content = await fetchGoogleDocHtml(newDocId);
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
  // Public audio proxy: stream a Google Drive audio file so it plays in a normal
  // <audio> player (no Google interstitial, correct headers, range/seek support).
  // The file must be shared "anyone with the link"; auth mirrors the Drive syncs.
  app.get("/api/audio/drive/:id", async (req, res) => {
    try {
      const id = req.params.id;
      if (!/^[A-Za-z0-9_-]+$/.test(id)) return res.status(400).json({ error: "bad id" });
      const { getDriveAccessToken } = await import("../googleDrive");
      const apiKey = process.env.GOOGLE_API_KEY;
      const range = req.headers.range ? String(req.headers.range) : undefined;
      const mediaUrl = (withKey: boolean) =>
        `https://www.googleapis.com/drive/v3/files/${id}?alt=media` + (withKey && apiKey ? `&key=${apiKey}` : "");
      const doFetch = async (useOAuth: boolean) => {
        const headers: Record<string, string> = {};
        if (range) headers["Range"] = range;
        if (useOAuth) {
          const token = await getDriveAccessToken();
          if (!token) return null;
          headers["Authorization"] = `Bearer ${token}`;
        }
        return fetch(mediaUrl(!useOAuth), { headers });
      };
      // Public files (SOP/training audio) read via API key; private app-created
      // uploads (practice videos) need the OAuth token. Try public first, then OAuth.
      let upstream = apiKey ? await doFetch(false) : null;
      if (!upstream || (!upstream.ok && (upstream.status === 403 || upstream.status === 404))) {
        const oauth = await doFetch(true);
        if (oauth) upstream = oauth;
      }
      if (!upstream) return res.status(500).json({ error: "Drive access not configured" });
      res.status(upstream.status);
      for (const h of ["content-type", "content-length", "accept-ranges", "content-range"]) {
        const v = upstream.headers.get(h);
        if (v) res.setHeader(h, v);
      }
      if (!res.getHeader("content-type")) res.setHeader("content-type", "audio/mpeg");
      res.setHeader("cache-control", "public, max-age=3600");
      if (!upstream.body) return res.end();
      const { Readable } = await import("stream");
      Readable.fromWeb(upstream.body as any).pipe(res);
    } catch (e) {
      console.error("[AudioProxy] error:", e);
      if (!res.headersSent) res.status(500).json({ error: String(e) });
    }
  });
  // One-off maintenance: list a Drive audio folder and attach files to modules'
  // audio players. Gated by the SETUP_SECRET header. action:"list" enumerates the
  // folder; otherwise each item sets a module's audioFiles to Drive-streamed URLs.
  app.post("/api/admin/audio-drive", async (req, res) => {
    const secret = process.env.SETUP_SECRET;
    if (!secret || req.headers["x-setup-secret"] !== secret) {
      return res.status(404).json({ error: "Not found" });
    }
    try {
      const { action, folderId, teamRole, items, apply } = req.body ?? {};
      const db = await import("../db");
      const { listDriveChildren, FOLDER_MIME } = await import("../googleDrive");

      if (action === "list") {
        if (!folderId) return res.status(400).json({ error: "folderId required" });
        const files = (await listDriveChildren(folderId)).filter(f => f.mimeType !== FOLDER_MIME);
        return res.json({ ok: true, count: files.length, files });
      }

      // Report every module that has audio attached, flagging which are still on
      // the old (broken) storage vs. already streaming from Drive.
      if (action === "audit") {
        const all = await db.getAllModules();
        const withAudio = all.filter((m: any) => Array.isArray(m.audioFiles) && m.audioFiles.length);
        const report = withAudio.map((m: any) => {
          const files = (m.audioFiles as any[]).map(a => ({
            label: a.label,
            url: a.url,
            broken: !(String(a.url).startsWith("/api/audio/") || /^https?:\/\//.test(String(a.url))),
          }));
          return { id: m.id, title: m.title, brokenCount: files.filter(f => f.broken).length, files };
        });
        return res.json({
          ok: true,
          modulesWithAudio: report.length,
          brokenModules: report.filter(r => r.brokenCount > 0).length,
          report,
        });
      }

      if (!Array.isArray(items)) return res.status(400).json({ error: "items[] required" });

      // Resolve a module set if teamRole is given (enables moduleMatch by title).
      let trackModules: any[] | null = null;
      if (typeof teamRole === "string" && teamRole.trim()) {
        const track = await db.getTrackByRole(teamRole);
        if (!track) return res.status(404).json({ error: `No track for teamRole "${teamRole}"` });
        const mss = await db.getMilestonesByTrack(track.id);
        trackModules = [];
        for (const ms of mss) {
          const mods = await db.getModulesByMilestone(ms.id);
          for (const m of mods) trackModules.push({ id: m.id, title: m.title });
        }
      }

      const dbc = await db.getDb();
      const { modules: modulesTable } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const results: any[] = [];
      for (const item of items) {
        let moduleId: number | null = typeof item.moduleId === "number" ? item.moduleId : null;
        if (!moduleId && typeof item.moduleMatch === "string" && trackModules) {
          const q = item.moduleMatch.toLowerCase();
          const matches = trackModules.filter(m => (m.title ?? "").toLowerCase().includes(q));
          if (matches.length !== 1) {
            results.push({ moduleMatch: item.moduleMatch, status: matches.length === 0 ? "no match" : "ambiguous", candidates: matches });
            continue;
          }
          moduleId = matches[0].id;
        }
        if (!moduleId || !Array.isArray(item.audio)) {
          results.push({ item, status: "need moduleId/moduleMatch and audio[]" });
          continue;
        }
        const audioFiles = item.audio.map((a: any) => ({ label: a.label, url: `/api/audio/drive/${a.driveId}` }));
        if (apply && dbc) {
          await dbc.update(modulesTable).set({ audioFiles }).where(eq(modulesTable.id, moduleId));
        }
        results.push({ moduleId, count: audioFiles.length, audioFiles, status: apply ? "attached" : "would attach" });
      }
      res.json({ ok: true, applied: !!apply, results });
    } catch (e: any) {
      console.error("[AudioDrive] error:", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });
  // One-off maintenance: attach reviewed quizzes to modules (and enable them).
  // Gated by the SETUP_SECRET header. action:"list" dumps a track's modules so
  // targets can be chosen; otherwise each item seeds a quiz on the matched
  // module. Dry run when apply=false. Seeded quizzes need no LLM to display.
  app.post("/api/admin/attach-quiz", async (req, res) => {
    const secret = process.env.SETUP_SECRET;
    if (!secret || req.headers["x-setup-secret"] !== secret) {
      return res.status(404).json({ error: "Not found" });
    }
    try {
      const { action, teamRole, items, apply } = req.body ?? {};
      const db = await import("../db");
      if (!teamRole) return res.status(400).json({ error: "teamRole required" });
      const track = await db.getTrackByRole(teamRole);
      if (!track) return res.status(404).json({ error: `No track for teamRole "${teamRole}"` });
      const milestones = await db.getMilestonesByTrack(track.id);

      // Build the track's module list (id, title, milestone).
      const trackModules: any[] = [];
      for (const ms of milestones) {
        const mods = await db.getModulesByMilestone(ms.id);
        for (const m of mods) trackModules.push({ id: m.id, title: m.title, milestone: ms.title, quizEnabled: m.quizEnabled });
      }

      if (action === "list") {
        return res.json({ ok: true, track: track.name, count: trackModules.length, modules: trackModules });
      }

      if (!Array.isArray(items)) return res.status(400).json({ error: "items[] required" });
      const dbc = await db.getDb();
      const { modules: modulesTable } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const results: any[] = [];
      for (const item of items) {
        let matched: any[];
        if (typeof item.moduleId === "number") {
          matched = trackModules.filter(m => m.id === item.moduleId);
        } else if (typeof item.moduleMatch === "string") {
          const q = item.moduleMatch.toLowerCase();
          matched = trackModules.filter(m => (m.title ?? "").toLowerCase().includes(q));
        } else {
          matched = [];
        }
        if (matched.length !== 1) {
          results.push({ quiz: item.name ?? item.moduleMatch, status: matched.length === 0 ? "no module match" : "ambiguous — matched " + matched.length, candidates: matched.map(m => ({ id: m.id, title: m.title })) });
          continue;
        }
        const target = matched[0];
        const qCount = Array.isArray(item.questions) ? item.questions.length : 0;
        if (apply && dbc) {
          await dbc.update(modulesTable).set({ quizEnabled: true }).where(eq(modulesTable.id, target.id));
          await db.upsertQuiz(target.id, item.questions, item.passingScore ?? 70);
        }
        results.push({ quiz: item.name ?? target.title, moduleId: target.id, moduleTitle: target.title, milestone: target.milestone, questions: qCount, status: apply ? "attached" : "would attach" });
      }
      res.json({ ok: true, applied: !!apply, results });
    } catch (e: any) {
      console.error("[AttachQuiz] error:", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });
  // One-off maintenance: re-pull SOP content from Google Docs as rich HTML
  // (tables/colors/structure) instead of stripped plain text. Gated by the
  // SETUP_SECRET header. Dry run when apply=false. Quiet — updates content
  // without flagging staff to re-review (this is a formatting migration).
  app.post("/api/admin/resync-sops-html", async (req, res) => {
    const secret = process.env.SETUP_SECRET;
    if (!secret || req.headers["x-setup-secret"] !== secret) {
      return res.status(404).json({ error: "Not found" });
    }
    try {
      const { sopId, sopMatch, all, apply } = req.body ?? {};
      const db = await import("../db");
      const { fetchGoogleDocHtml } = await import("../googleDrive");
      const allSops = await db.getAllSops();
      let targets: any[];
      if (typeof sopId === "number") {
        targets = allSops.filter((s: any) => s.id === sopId);
      } else if (typeof sopMatch === "string" && sopMatch.trim()) {
        const m = sopMatch.toLowerCase();
        targets = allSops.filter((s: any) => (s.title ?? "").toLowerCase().includes(m));
      } else if (all) {
        targets = allSops;
      } else {
        return res.status(400).json({ error: "sopId, sopMatch, or all:true required" });
      }
      let updated = 0;
      const results: any[] = [];
      for (const sop of targets) {
        if (!sop.googleDocId) {
          results.push({ id: sop.id, title: sop.title, status: "skipped (no googleDocId)" });
          continue;
        }
        try {
          const html = await fetchGoogleDocHtml(sop.googleDocId);
          const changed = html !== sop.content;
          if (apply && changed) {
            await db.repointSop(sop.id, { googleDocId: sop.googleDocId, title: sop.title, content: html });
            updated++;
          }
          results.push({
            id: sop.id,
            title: sop.title,
            bytes: html.length,
            hasTable: /<table/i.test(html),
            status: !changed ? "already html" : apply ? "updated" : "would update",
          });
        } catch (e: any) {
          results.push({ id: sop.id, title: sop.title, status: `error: ${e.message}` });
        }
      }
      res.json({ ok: true, applied: !!apply, matched: targets.length, updated, sops: results });
    } catch (e: any) {
      console.error("[ResyncSopsHtml] error:", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });
  // One-off maintenance: delete modules by id or title match from a track.
  // Gated by the SETUP_SECRET header. Dry run when apply=false.
  app.post("/api/admin/delete-module", async (req, res) => {
    const secret = process.env.SETUP_SECRET;
    if (!secret || req.headers["x-setup-secret"] !== secret) {
      return res.status(404).json({ error: "Not found" });
    }
    try {
      const { moduleIds, titleMatch, teamRole, apply } = req.body ?? {};
      const db = await import("../db");
      const all = await db.getAllModules();

      // Optionally restrict to one track's modules (via its milestones).
      let allowedMilestones: Set<number> | null = null;
      if (typeof teamRole === "string" && teamRole.trim()) {
        const track = await db.getTrackByRole(teamRole);
        if (!track) return res.status(404).json({ error: `No track for teamRole "${teamRole}"` });
        const mss = await db.getMilestonesByTrack(track.id);
        allowedMilestones = new Set(mss.map((m: any) => m.id));
      }

      let matched: any[];
      if (Array.isArray(moduleIds) && moduleIds.length) {
        const idset = new Set(moduleIds.map((n: any) => Number(n)));
        matched = all.filter((m: any) => idset.has(m.id));
      } else if (typeof titleMatch === "string" && titleMatch.trim()) {
        const t = titleMatch.toLowerCase();
        matched = all.filter((m: any) => (m.title ?? "").toLowerCase().includes(t));
      } else {
        return res.status(400).json({ error: "moduleIds (array) or titleMatch (string) required" });
      }
      if (allowedMilestones) {
        matched = matched.filter((m: any) => allowedMilestones!.has(m.milestoneId));
      }

      let deleted = 0;
      if (apply) {
        const { modules: modulesTable } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db2 = await db.getDb();
        if (!db2) throw new Error("Database unavailable");
        for (const m of matched) {
          await db2.delete(modulesTable).where(eq(modulesTable.id, m.id));
          deleted++;
        }
      }
      res.json({
        ok: true,
        applied: !!apply,
        deleted,
        matchedCount: matched.length,
        matched: matched.map((m: any) => ({ id: m.id, title: m.title, type: m.type, milestoneId: m.milestoneId })),
      });
    } catch (e: any) {
      console.error("[DeleteModule] error:", e);
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
      const { sopMatch, sopId, moduleMatch, moduleIds, apply, replace, asPrimary } = req.body ?? {};
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

        // asPrimary rewrites the module's own sopId (what the viewer renders as
        // the primary SOP) and is a *distinct* operation from the moduleSops
        // "Related SOP" links: it fixes a module that points its primary at the
        // wrong doc, without also adding a duplicate related link for that doc.
        const primaryChanged = asPrimary && mod.sopId !== sop.id;

        if (apply) {
          for (const r of toRemove) {
            await db.unlinkModuleFromSop(mod.id, r.id);
            unlinked++;
          }
          if (asPrimary) {
            if (primaryChanged) await db.setModulePrimarySop(mod.id, sop.id);
          } else if (!already) {
            await db.linkModuleToSop(mod.id, sop.id);
            linked++;
          }
        }

        const status = asPrimary
          ? (apply ? (primaryChanged ? "primary set" : "already primary") : "would set primary")
          : already
            ? (toRemove.length ? "already linked (removed others)" : "already linked")
            : (apply ? "linked" : "would link");
        results.push({
          id: mod.id,
          title: mod.title,
          milestoneId: mod.milestoneId,
          currentPrimarySopId: mod.sopId ?? null,
          setsPrimary: asPrimary ? sop.id : undefined,
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
  // Scheduled cleanup: purge old practice videos from Drive so storage never
  // accumulates. Safe to call anytime; only removes reviewed/expired uploads.
  app.post("/api/scheduled/video-cleanup", async (_req, res) => {
    try {
      const { cleanupOldPracticeVideos } = await import("../videoCleanup");
      const result = await cleanupOldPracticeVideos();
      console.log(`[VideoCleanup] deleted=${result.deleted} scanned=${result.scanned}`);
      res.json({ ok: true, ...result });
    } catch (e) {
      console.error("[VideoCleanup] error:", e);
      res.status(500).json({ ok: false, error: String(e) });
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
      // Prefer Google Drive when write access is configured; otherwise fall back
      // to S3-compatible storage (legacy path).
      const { driveWriteEnabled, uploadToDrive } = await import("../googleDrive");
      if (await driveWriteEnabled()) {
        const name = req.file.originalname || `practice-video-${Date.now()}.${ext}`;
        const fileId = await uploadToDrive(name, contentType, req.file.buffer);
        return res.json({ key: `gdrive:${fileId}`, storageUrl: `/api/audio/drive/${fileId}` });
      }
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
  // Every Monday 04:00 UTC — purge old practice videos from Drive
  cron.schedule("0 4 * * 1", () => hit("/api/scheduled/video-cleanup"), {
    timezone: "UTC",
  });
  console.log("[Cron] Weekly library-sync, sop-sync, and video-cleanup scheduled (UTC).");
}

startServer().catch(console.error);
