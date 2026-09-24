import { eq, inArray } from "drizzle-orm";
import { moduleSops, modules, sops } from "../drizzle/schema";
import * as db from "./db";
import { fetchGoogleDocHtml } from "./googleDrive";

// Boot-time data fix: make the current Cherry Financing doc the only Cherry SOP.
// - Every module with "Cherry" in its title, and every module (any track) that
//   used a retired Cherry SOP as primary or related, now uses the current doc.
// - Retired Cherry SOPs ("Copy of Cherry Financing") are hidden (isActive=false)
//   so they drop out of the SOP library. Deactivated rather than deleted so a
//   Drive re-sync of the old doc can't re-create it as a fresh active SOP.
// Idempotent — no writes once everything already points at the current doc.
// Safe to delete after it has run.

const CHERRY_DOC_ID = "13R_dOeUtMk8xmr6sChSsuDfooW9fCOXjtJ14e9Ohjy0";
const CHERRY_SOP_TITLE = "Cherry Financing (Care Plan Option 2)";
const isRetiredCherry = (s: { title: string | null; googleDocId: string | null }) =>
  s.googleDocId !== CHERRY_DOC_ID && /^copy of cherry financing/i.test((s.title ?? "").trim());

export async function ensureCherrySop() {
  const dbc = await db.getDb();
  if (!dbc) return;

  const allSops = await dbc.select().from(sops);
  const retired = allSops.filter(isRetiredCherry);
  const retiredIds = retired.map((s) => s.id);

  const allMods = await dbc.select().from(modules);
  const relatedLinks = retiredIds.length
    ? await dbc.select().from(moduleSops).where(inArray(moduleSops.sopId, retiredIds))
    : [];
  const relatedModIds = new Set(relatedLinks.map((l) => l.moduleId));
  const targets = allMods.filter((m) =>
    (m.title ?? "").toLowerCase().includes("cherry") ||
    (m.sopId != null && retiredIds.includes(m.sopId)) ||
    relatedModIds.has(m.id));

  let target = allSops.find((s) => s.googleDocId === CHERRY_DOC_ID);
  const needsWork =
    !target ||
    !target.isActive ||
    retired.some((s) => s.isActive) ||
    relatedLinks.length > 0 ||
    targets.some((m) => m.sopId !== target!.id && ((m.title ?? "").toLowerCase().includes("cherry") || retiredIds.includes(m.sopId ?? -1)));
  if (!needsWork) return;

  if (!target) {
    const content = await fetchGoogleDocHtml(CHERRY_DOC_ID);
    const catId = retired[0]?.categoryId ?? await db.getOrCreateSopCategory("General", "general");
    await db.upsertSop({ googleDocId: CHERRY_DOC_ID, title: CHERRY_SOP_TITLE, content, categoryId: catId, lastUpdated: new Date() });
    target = await db.getSopByGoogleDocId(CHERRY_DOC_ID);
    if (!target) throw new Error("SOP not found after import");
    console.log(`[CherrySop] imported ${CHERRY_DOC_ID} as SOP #${target.id}`);
  } else if (!target.isActive) {
    await dbc.update(sops).set({ isActive: true }).where(eq(sops.id, target.id));
  }

  for (const m of targets) {
    const isCherryModule = (m.title ?? "").toLowerCase().includes("cherry");
    if (m.sopId !== target.id && (isCherryModule || retiredIds.includes(m.sopId ?? -1))) {
      await db.setModulePrimarySop(m.id, target.id);
      console.log(`[CherrySop] module #${m.id} "${m.title}" primary SOP ${m.sopId ?? "none"} -> #${target.id}`);
    }
    for (const id of retiredIds) await db.unlinkModuleFromSop(m.id, id);
    // The current doc is primary on Cherry modules; elsewhere keep it as a related link.
    if (relatedModIds.has(m.id) && m.sopId !== target.id && !(isCherryModule || retiredIds.includes(m.sopId ?? -1))) {
      await db.linkModuleToSop(m.id, target.id);
      console.log(`[CherrySop] module #${m.id} "${m.title}" related link -> #${target.id}`);
    } else {
      await db.unlinkModuleFromSop(m.id, target.id);
    }
  }

  for (const s of retired) {
    if (s.isActive) {
      await dbc.update(sops).set({ isActive: false }).where(eq(sops.id, s.id));
      console.log(`[CherrySop] retired SOP #${s.id} "${s.title}"`);
    }
  }
}
