import * as db from "./db";
import { fetchGoogleDocHtml } from "./googleDrive";

// Boot-time data fix: make the Cherry module(s) use the current Cherry Financing
// SOP doc as their primary SOP. Idempotent — once every Cherry module points at
// this doc it does nothing (no fetch, no writes). Safe to delete after it has run.

const CHERRY_DOC_ID = "13R_dOeUtMk8xmr6sChSsuDfooW9fCOXjtJ14e9Ohjy0";
const CHERRY_SOP_TITLE = "Cherry Financing (Care Plan Option 2)";

export async function ensureCherrySop() {
  const mods = (await db.getAllModules()).filter((m: any) => (m.title ?? "").toLowerCase().includes("cherry"));
  if (!mods.length) {
    console.log("[CherrySop] no Cherry module found — skipping");
    return;
  }

  let target = await db.getSopByGoogleDocId(CHERRY_DOC_ID);
  if (target && mods.every((m: any) => m.sopId === target!.id)) return;

  const content = await fetchGoogleDocHtml(CHERRY_DOC_ID);
  if (!target) {
    // Repoint the module's existing SOP row at the new doc so the library keeps a
    // single Cherry SOP and any related links survive; import fresh if there is none.
    const current = mods[0].sopId ? await db.getSopById(mods[0].sopId) : undefined;
    if (current) {
      await db.repointSop(current.id, { googleDocId: CHERRY_DOC_ID, title: CHERRY_SOP_TITLE, content });
      console.log(`[CherrySop] repointed SOP #${current.id} from ${current.googleDocId} to ${CHERRY_DOC_ID}`);
    } else {
      const catId = await db.getOrCreateSopCategory("General", "general");
      await db.upsertSop({ googleDocId: CHERRY_DOC_ID, title: CHERRY_SOP_TITLE, content, categoryId: catId, lastUpdated: new Date() });
      console.log(`[CherrySop] imported ${CHERRY_DOC_ID} as a new SOP`);
    }
    target = await db.getSopByGoogleDocId(CHERRY_DOC_ID);
    if (!target) throw new Error("SOP not found after import");
  }

  for (const m of mods) {
    if (m.sopId !== target.id) {
      await db.setModulePrimarySop(m.id, target.id);
      console.log(`[CherrySop] module #${m.id} "${m.title}" primary SOP ${m.sopId ?? "none"} -> #${target.id}`);
    }
    // Drop a duplicate "Related SOP" link to the same doc, if one exists.
    await db.unlinkModuleFromSop(m.id, target.id);
  }
}
