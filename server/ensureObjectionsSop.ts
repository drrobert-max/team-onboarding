import * as db from "./db";
import { fetchGoogleDocHtml } from "./googleDrive";

// Boot-time data fix: put the "Care Plan Objections: Keeping the First
// Adjustment" SOP on the modules that teach it.
// - CA "Begin Learning Objections": primary SOP (any previous primary is kept
//   as a Related SOP).
// - Every other CA module with "objection" in its title (e.g. the test-out):
//   primary SOP if the module has none, otherwise a Related SOP.
// - Associate Doctor "Spousal/permission objections — 3-day grace period close":
//   primary SOP if the module has none, otherwise a Related SOP.
// Idempotent — once every module carries the SOP it does nothing (no fetch, no
// writes). Safe to delete after it has run.

const OBJECTIONS_DOC_ID = "1vUXlEwUE15bNvdZ11kiYnOAetVXUuYfnuUh7LUJ72s4";
const OBJECTIONS_SOP_TITLE = "Care Plan Objections: Keeping the First Adjustment";
// Same category the weekly Drive sync derives from the doc's folder (Scripts).
const CATEGORY = { name: "Scripts", slug: "scripts" };

const title = (m: any) => (m.title ?? "").trim().toLowerCase();
const isCaPrimary = (m: any) => title(m) === "begin learning objections";
const isCaOther = (m: any) => !isCaPrimary(m) && title(m).includes("objection");
const isDoctorSpousal = (m: any) => title(m).includes("spousal") && title(m).includes("grace period");

async function trackModules(teamRole: string): Promise<any[]> {
  const track = await db.getTrackByRole(teamRole);
  if (!track) return [];
  const mods: any[] = [];
  for (const ms of await db.getMilestonesByTrack(track.id)) {
    mods.push(...(await db.getModulesByMilestone(ms.id)));
  }
  return mods;
}

export async function ensureObjectionsSop() {
  const caMods = await trackModules("ca");
  const doctorMods = await trackModules("associate_doctor");
  const primaryMods = caMods.filter(isCaPrimary);
  const relatedMods: any[] = [];
  // Primary only when the module has no SOP of its own yet; never replace one.
  for (const m of [...caMods.filter(isCaOther), ...doctorMods.filter(isDoctorSpousal)]) {
    (m.sopId ? relatedMods : primaryMods).push(m);
  }
  if (!caMods.some((m) => isCaPrimary(m) || isCaOther(m))) {
    console.log(`[ObjectionsSop] no CA objections module found (CA titles: ${caMods.map((m) => m.title).join(" | ")})`);
  }
  if (!primaryMods.length && !relatedMods.length) return;

  let sop = await db.getSopByGoogleDocId(OBJECTIONS_DOC_ID);
  if (sop) {
    const sopId = sop.id;
    const done = primaryMods.every((m) => m.sopId === sopId);
    const linked = await Promise.all(
      relatedMods.map(async (m) => m.sopId === sopId || (await db.getModuleSops(m.id)).some((l: any) => l.id === sopId)),
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
    if (m.sopId === sop.id) continue;
    if (await db.linkModuleToSop(m.id, sop.id)) {
      console.log(`[ObjectionsSop] module #${m.id} "${m.title}" linked SOP #${sop.id}`);
    }
  }
}
