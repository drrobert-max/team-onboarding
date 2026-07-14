import { Request, Response } from "express";
import * as db from "./db";

// Google Drive document IDs for the Care Plans SOPs to sync
const CARE_PLAN_SOPS = [
  { googleDocId: "15sQRjXkwogc1A_QWny6z9NculbllHDPSHyXW088M9g8", title: "12WBR SOP" },
  { googleDocId: "1zFbEkxCTJsPaxx_G_TGIAjM-ogQBMvsV7fr0GbE0W68", title: "12WBR EXT Plan 24 weeks" },
  { googleDocId: "1lwiToxCDeLQkbsLVW_s36vZRmuC_9NylCjJdUkZj5Ys", title: "6 Month Behavior Reset" },
  { googleDocId: "13IExfoOlxXlUtzcTY_PTSvX4hL1co28Lk1-I_8m7_9A", title: "Wellness Billing Guidelines" },
];

const CARE_PLANS_CATEGORY_ID = 3;

/**
 * Fetch a Google Doc's plain text via the public export endpoint.
 * Requires the doc to be shared as "anyone with the link can view" —
 * no API key or OAuth needed. Throws if the doc isn't accessible.
 */
async function fetchGoogleDocText(googleDocId: string): Promise<string> {
  const url = `https://docs.google.com/document/d/${googleDocId}/export?format=txt`;
  const resp = await fetch(url, { redirect: "follow" });
  if (!resp.ok) {
    throw new Error(
      `export fetch failed (HTTP ${resp.status}) — is the doc shared as "anyone with link"?`
    );
  }
  const text = await resp.text();
  // A private doc redirects to a Google login page (HTML) instead of text.
  if (text.trimStart().toLowerCase().startsWith("<!doctype html") || text.includes("<html")) {
    throw new Error(`doc is not publicly accessible — share it as "anyone with link: viewer"`);
  }
  // Strip BOM and normalize line endings
  return text.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();
}

export async function scheduledSopSyncHandler(req: Request, res: Response) {
  try {
    let updated = 0;
    let added = 0;
    const errors: string[] = [];

    for (const sop of CARE_PLAN_SOPS) {
      try {
        const content = await fetchGoogleDocText(sop.googleDocId);

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

    console.log(`[SopSync] done — added ${added}, updated ${updated}, errors: ${errors.length}`);
    res.json({ ok: true, updated, added, errors });
  } catch (err: any) {
    res.status(500).json({
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
}
