import { Request, Response } from "express";
import { execSync } from "child_process";
import * as db from "./db";

// Google Drive document IDs for the Care Plans SOPs to sync
const CARE_PLAN_SOPS = [
  { googleDocId: "15sQRjXkwogc1A_QWny6z9NculbllHDPSHyXW088M9g8", title: "12WBR SOP" },
  { googleDocId: "1zFbEkxCTJsPaxx_G_TGIAjM-ogQBMvsV7fr0GbE0W68", title: "12WBR EXT Plan 24 weeks" },
  { googleDocId: "1lwiToxCDeLQkbsLVW_s36vZRmuC_9NylCjJdUkZj5Ys", title: "6 Month Behavior Reset" },
  { googleDocId: "13IExfoOlxXlUtzcTY_PTSvX4hL1co28Lk1-I_8m7_9A", title: "Wellness Billing Guidelines" },
];

const CARE_PLANS_CATEGORY_ID = 3;

function extractTextFromGoogleDoc(docData: any): string {
  let text = "";
  const bodyContent = docData?.body?.content || [];
  for (const elem of bodyContent) {
    const para = elem?.paragraph;
    if (!para) continue;
    for (const pe of para.elements || []) {
      text += pe?.textRun?.content || "";
    }
  }
  return text;
}

export async function scheduledSopSyncHandler(req: Request, res: Response) {
  try {
    let updated = 0;
    let added = 0;
    const errors: string[] = [];

    for (const sop of CARE_PLAN_SOPS) {
      try {
        const raw = execSync(
          `gws docs documents get --params '{"documentId":"${sop.googleDocId}"}' --format json`,
          { encoding: "utf8", timeout: 30000 }
        );
        const docData = JSON.parse(raw);
        const content = extractTextFromGoogleDoc(docData);

        const existing = await db.getSopByGoogleDocId(sop.googleDocId);
        if (existing) {
          if (existing.content !== content) {
            await db.upsertSop({
              googleDocId: sop.googleDocId,
              title: sop.title,
              content,
              categoryId: CARE_PLANS_CATEGORY_ID,
              lastUpdated: new Date(),
            });
            await db.flagSopForAllUsers(existing.id, "SOP updated — please re-review");
            updated++;
          }
        } else {
          await db.upsertSop({
            googleDocId: sop.googleDocId,
            title: sop.title,
            content,
            categoryId: CARE_PLANS_CATEGORY_ID,
            lastUpdated: new Date(),
          });
          added++;
        }
      } catch (err: any) {
        errors.push(`${sop.title}: ${err.message}`);
      }
    }

    res.json({ ok: true, updated, added, errors });
  } catch (err: any) {
    res.status(500).json({
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
  }
}
