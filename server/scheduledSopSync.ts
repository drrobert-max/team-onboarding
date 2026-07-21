import { Request, Response } from "express";
import * as db from "./db";
import { listDriveChildren, fetchGoogleDocHtml, FOLDER_MIME, DOC_MIME } from "./googleDrive";
import { sendSopUpdatedEmail } from "./emailAuth";

// The top-level Google Drive folder that holds the SOP library. Its subfolders
// become categories and the Google Docs inside them become SOPs. Overridable per
// deployment via SOP_DRIVE_FOLDER_ID; defaults to the Reformation SOP folder.
const SOP_ROOT_FOLDER_ID =
  process.env.SOP_DRIVE_FOLDER_ID ?? "1a_jzDJAZFH92Ez-Ixtzu1wlvtdG5Frbi";

function slugify(s: string): string {
  return (
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 200) || "general"
  );
}

export type SopSyncResult = {
  categories: number;
  added: number;
  updated: number;
  errors: string[];
  updatedTitles: string[];
};

/**
 * Mirror the Google Drive SOP folder into the app's SOP library:
 * root folder → subfolders become categories → Google Docs become SOPs.
 * When an existing SOP's content changes it's re-versioned, staff are flagged
 * to re-review, and a bell notification + email go out. Brand-new SOPs are added
 * silently (so the first sync doesn't spam everyone about the whole library).
 */
export async function syncSopsFromDrive(): Promise<SopSyncResult> {
  const errors: string[] = [];
  let added = 0;
  let updated = 0;
  const changed: { id: number; title: string }[] = [];

  // Sync a list of docs into a given category, tracking adds/updates.
  const syncDocs = async (docs: { id: string; name: string }[], categoryId: number) => {
    for (const doc of docs) {
      try {
        const content = await fetchGoogleDocHtml(doc.id);
        const existing = await db.getSopByGoogleDocId(doc.id);
        if (existing) {
          if (existing.content !== content) {
            await db.upsertSop({ googleDocId: doc.id, title: doc.name, content, categoryId, lastUpdated: new Date() });
            // A plain-text → HTML change is the one-time formatting migration, not
            // a real content edit — store it but don't flag/notify everyone.
            const isFormatMigration =
              !existing.content.trimStart().startsWith("<") && content.trimStart().startsWith("<");
            if (!isFormatMigration) {
              await db.flagSopForAllUsers(existing.id, "SOP updated — please re-review");
              changed.push({ id: existing.id, title: doc.name });
            }
            updated++;
          }
          // Keep category/title aligned with Drive — this also repairs any SOP
          // saved with the wrong category by an earlier run.
          if (existing.categoryId !== categoryId || existing.title !== doc.name) {
            await db.updateSopCategoryAndTitle(existing.id, categoryId, doc.name);
          }
        } else {
          await db.upsertSop({ googleDocId: doc.id, title: doc.name, content, categoryId, lastUpdated: new Date() });
          added++;
        }
      } catch (e: any) {
        errors.push(`${doc.name}: ${e.message}`);
      }
    }
  };

  // 1. Read the root folder's direct children.
  let children;
  try {
    children = await listDriveChildren(SOP_ROOT_FOLDER_ID);
  } catch (e: any) {
    errors.push(`Could not read the SOP folder: ${e.message}`);
    return { categories: 0, added, updated, errors, updatedTitles: [] };
  }
  const subfolders = children.filter((c) => c.mimeType === FOLDER_MIME);
  const rootDocs = children.filter((c) => c.mimeType === DOC_MIME);

  // 2. Any docs sitting loose in the root → a "General" category.
  if (rootDocs.length) {
    try {
      const catId = await db.getOrCreateSopCategory("General", "general");
      await syncDocs(rootDocs.map((d) => ({ id: d.id, name: d.name })), catId);
    } catch (e: any) {
      errors.push(`General: ${e.message}`);
    }
  }

  // 3. Each subfolder → a category, its docs → SOPs.
  let categories = 0;
  for (const folder of subfolders) {
    try {
      const catId = await db.getOrCreateSopCategory(folder.name, slugify(folder.name));
      categories++;
      const docs = await listDriveChildren(folder.id, DOC_MIME);
      await syncDocs(docs.map((d) => ({ id: d.id, name: d.name })), catId);
    } catch (e: any) {
      errors.push(`Category "${folder.name}": ${e.message}`);
    }
  }

  // 4. Notify staff about SOPs whose content actually changed.
  if (changed.length) {
    try {
      await notifyStaffOfSopUpdates(changed);
    } catch (e: any) {
      errors.push(`notify: ${e.message}`);
    }
  }

  return { categories, added, updated, errors, updatedTitles: changed.map((c) => c.title) };
}

async function notifyStaffOfSopUpdates(changed: { id: number; title: string }[]) {
  const users = (await db.getAllUsers()).filter((u) => u.approvalStatus === "approved");
  const titles = changed.map((c) => c.title);
  for (const u of users) {
    // In-app bell notification — one per changed SOP so each is clickable.
    for (const c of changed) {
      await db.createNotification({
        userId: u.id,
        type: "sop_updated",
        title: `SOP updated: ${c.title}`,
        message: `"${c.title}" was updated. Please review the latest version.`,
        relatedId: c.id,
      });
    }
    // One digest email per person (best-effort; no-op if Gmail isn't configured).
    if (u.email) {
      try {
        await sendSopUpdatedEmail(u.email, u.name ?? "", titles);
      } catch { /* email is best-effort — never fail the sync over it */ }
    }
  }
}

// HTTP entry point used by the weekly scheduler (POST /api/scheduled/sop-sync).
export async function scheduledSopSyncHandler(_req: Request, res: Response) {
  try {
    const result = await syncSopsFromDrive();
    console.log(
      `[SopSync] categories=${result.categories} added=${result.added} updated=${result.updated} errors=${result.errors.length}`
    );
    res.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("[SopSync] Handler error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
}
