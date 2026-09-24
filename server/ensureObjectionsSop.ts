import * as db from "./db";
import { fetchGoogleDocHtml } from "./googleDrive";

// Boot-time data fix: put the "Care Plan Objections: Keeping the First
// Adjustment" SOP on the CA track. "Begin Learning Objections" gets it as its
// primary SOP (any previous primary is kept as a Related SOP), and "Proficient
// at Objections" gets it as a Related SOP. Idempotent — once both modules carry
// the SOP it does nothing (no fetch, no writes). Safe to delete after it has run.

const OBJECTIONS_DOC_ID = "1vUXlEwUE15bNvdZ11kiYnOAetVXUuYfnuUh7LUJ72s4";
const OBJECTIONS_SOP_TITLE = "Care Plan Objections: Keeping the First Adjustment";
// Same category the weekly Drive sync derives from the doc's folder (Scripts).
const CATEGORY = { name: "Scripts", slug: "scripts" };

const PRIMARY_TITLE = "begin learning objections";
const RELATED_TITLE = "proficient at objections";

export async function ensureObjectionsSop() {
  const track = await db.getTrackByRole("ca");
  if (!track) {
    console.log("[ObjectionsSop] no CA track — skipping");
    return;
  }
  const mods: any[] = [];
  for (const ms of await db.getMilestonesByTrack(track.id)) {
    mods.push(...(await db.getModulesByMilestone(ms.id)));
  }
  const title = (m: any) => (m.title ?? "").trim().toLowerCase();
  const primaryMods = mods.filter((m) => title(m) === PRIMARY_TITLE);
  const relatedMods = mods.filter((m) => title(m) === RELATED_TITLE);
  if (!primaryMods.length && !relatedMods.length) {
    console.log("[ObjectionsSop] no matching CA modules — skipping");
    return;
  }

  let sop = await db.getSopByGoogleDocId(OBJECTIONS_DOC_ID);
  if (sop) {
    const sopId = sop.id;
    const done = primaryMods.every((m) => m.sopId === sopId);
    const linked = await Promise.all(
      relatedMods.map(async (m) => (await db.getModuleSops(m.id)).some((l: any) => l.id === sopId)),
    );
    if (done && linked.every(Boolean)) return;
  } else {
    const content = await fetchGoogleDocHtml(OBJECTIONS_DOC_ID);
    const catId = await db.getOrCreateSopCategory(CATEGORY.name, CATEGORY.slug);
    await db.upsertSop({ googleDocId: OBJECTIONS_DOC_ID, title: OBJECTIONS_SOP_TITLE, content, categoryId: catId, lastUpdated: new Date() });
    sop = await db.getSopByGoogleDocId(OBJECTIONS_DOC_ID);
    if (!sop) throw new Error("SOP not found after import");
    console.log(`[ObjectionsSop] imported ${OBJECTIONS_DOC_ID} as SOP #${sop.id}`);
  }

  for (const m of primaryMods) {
    if (m.sopId === sop.id) continue;
    // Keep the old primary reachable as a Related SOP rather than dropping it.
    if (m.sopId) await db.linkModuleToSop(m.id, m.sopId);
    await db.setModulePrimarySop(m.id, sop.id);
    await db.unlinkModuleFromSop(m.id, sop.id);
    console.log(`[ObjectionsSop] module #${m.id} "${m.title}" primary SOP ${m.sopId ?? "none"} -> #${sop.id}`);
  }
  for (const m of relatedMods) {
    if (await db.linkModuleToSop(m.id, sop.id)) {
      console.log(`[ObjectionsSop] module #${m.id} "${m.title}" linked SOP #${sop.id}`);
    }
  }
}
