import * as db from "./db";
import { fetchGoogleDocHtml } from "./googleDrive";

// One-off maintenance helper: add a Google Doc to the SOP library and (optionally)
// link it as a "Related SOP" to every module whose text mentions a keyword.
// Runs behind a secret-gated endpoint; supports a dry run (apply=false) that
// reports the matching modules without changing any links.

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 200) || "general";
}

export async function runAttachSopToModules(opts: {
  docId: string;
  title: string;
  category: string;
  keyword: string;
  apply: boolean;
}) {
  const { docId, title, category, keyword, apply } = opts;

  // 1. Add / update the SOP from the Google Doc.
  const content = await fetchGoogleDocHtml(docId);
  const categoryId = await db.getOrCreateSopCategory(category, slugify(category));
  await db.upsertSop({ googleDocId: docId, title, content, categoryId, lastUpdated: new Date() });
  const sop = await db.getSopByGoogleDocId(docId);
  if (!sop) throw new Error("Failed to add the SOP.");

  // 2. Find modules whose title/description/task text mentions the keyword.
  const kw = keyword.toLowerCase();
  const all = await db.getAllModules();
  const matched = all.filter((m: any) => {
    const hay = `${m.title ?? ""}\n${m.description ?? ""}\n${m.taskInstructions ?? ""}`.toLowerCase();
    return hay.includes(kw);
  });

  // 3. Optionally link the SOP to each matched module.
  let linked = 0;
  if (apply) {
    for (const m of matched) {
      if (await db.linkModuleToSop(m.id, sop.id)) linked++;
    }
  }

  return {
    sopId: sop.id,
    sopTitle: sop.title,
    category,
    keyword,
    applied: apply,
    linked,
    matchedCount: matched.length,
    matchedModules: matched.map((m: any) => ({ id: m.id, title: m.title })),
  };
}
