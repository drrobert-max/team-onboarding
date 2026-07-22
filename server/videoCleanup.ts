import { getDb } from "./db";
import { videoSubmissions } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { deleteDriveFile } from "./googleDrive";

// Practice videos are ephemeral: once a submission has been reviewed, the raw
// video isn't needed long-term (the written/voice feedback stays on the record).
// So storage manages itself and never accumulates.
const REVIEWED_TTL_DAYS = 30; // delete the video this long after it's reviewed
const HARD_TTL_DAYS = 90;     // safety cap: delete any practice video this old

const DAY = 86_400_000;

/**
 * Delete Drive-hosted practice videos that have outlived their usefulness and
 * clear their file references. Only touches Drive-hosted uploads (gdrive: keys);
 * the submission record (title, feedback, grade) is kept.
 */
export async function cleanupOldPracticeVideos(): Promise<{ deleted: number; scanned: number }> {
  const db = await getDb();
  if (!db) return { deleted: 0, scanned: 0 };
  const rows = await db.select().from(videoSubmissions);
  const now = Date.now();
  let deleted = 0;
  for (const v of rows) {
    if (!v.fileKey || !v.fileKey.startsWith("gdrive:")) continue;
    const reviewedOld =
      v.status === "reviewed" && v.reviewedAt &&
      now - new Date(v.reviewedAt as any).getTime() > REVIEWED_TTL_DAYS * DAY;
    const hardOld =
      v.createdAt && now - new Date(v.createdAt as any).getTime() > HARD_TTL_DAYS * DAY;
    if (reviewedOld || hardOld) {
      await deleteDriveFile(v.fileKey.slice("gdrive:".length));
      await db.update(videoSubmissions).set({ fileKey: "", fileUrl: "" }).where(eq(videoSubmissions.id, v.id));
      deleted++;
    }
  }
  return { deleted, scanned: rows.length };
}
