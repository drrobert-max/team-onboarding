/**
 * Build weekly test-out milestones (and their graded skill modules) into a
 * training track. Used by the SETUP_SECRET-gated /api/admin/build-testouts
 * endpoint so per-track test-outs can be seeded without a Track Editor session.
 *
 * Model (matches client/src/pages/TestOuts.tsx):
 *  - A milestone whose title contains a test-out keyword (e.g. "Test Out") is
 *    treated as a test-out and shown on the /test-outs page, not the training
 *    view. Test-outs unlock in a chain by sortOrder; a milestone "passes" once
 *    every module in it is graded "mastered".
 *  - Each skill becomes a `task` module inside that milestone, graded
 *    Mastered / Needs improvement.
 *
 * Three kinds of work, any combination in one call:
 *  - `weeks`      — build a whole test-out milestone (+ its skills) per week.
 *  - `trainingModules` — add a regular module to an existing training week.
 *  - `testOutModules`  — add one graded skill to the test-out for an existing
 *    week, reusing that week's test-out milestone whatever it is called, and
 *    creating one *in week order* only when the week has none. Use this to slot
 *    a single skill into a track whose test-out chain is already built.
 *
 * Idempotent: re-running skips a milestone that already exists (matched by
 * title) and skips any skill already present in it (matched by title). This
 * means a dry run (apply=false) and a later apply produce the same shape, and
 * re-applying never duplicates.
 */
import { eq } from "drizzle-orm";
import * as db from "./db";
import { milestones as milestonesTable, modules as modulesTable } from "../drizzle/schema";

const TEST_OUT_KEYWORDS = ["test out", "check-in", "check in", "60-day", "60 day"];
function isTestOut(title: string): boolean {
  const l = title.toLowerCase();
  return TEST_OUT_KEYWORDS.some(k => l.includes(k));
}

export interface WeekSpec {
  week: number;
  theme: string;
  skills: string[];
}

/** A regular (non-test-out) training module to add to an existing training week. */
export interface TrainingModuleSpec {
  week: number;
  title: string;
  description?: string;
  instructions?: string;
  type?: "sop" | "video" | "task" | "checklist";
}

/** A single graded skill to add to the test-out for an existing week. */
export interface TestOutModuleSpec {
  week: number;
  title: string;
  description?: string;
  instructions?: string;
}

/**
 * Decide where a graded skill for `week` belongs: an existing test-out
 * milestone for that week, or a new one and the position it takes.
 *
 * `ordered` must be the track's milestones in sortOrder — the same order the
 * /test-outs page unlocks them in. A new test-out therefore goes right after
 * the last milestone at or before its week, never appended to the end (which
 * would put Week 7 behind Week 12 in the unlock chain).
 */
export function planTestOutSlot(
  ordered: { id: number; title: string; weekNumber: number }[],
  week: number,
): { kind: "existing"; milestoneId: number } | { kind: "create"; index: number } {
  const match = ordered.find(m => m.weekNumber === week && isTestOut(m.title));
  if (match) return { kind: "existing", milestoneId: match.id };
  let index = 0;
  ordered.forEach((m, i) => {
    if (m.weekNumber <= week) index = i + 1;
  });
  return { kind: "create", index };
}

const GRADE_NOTE =
  "Demonstrate this live to your supervising doctor during your weekly test-out. " +
  "Graded Mastered / Needs improvement — anything not yet mastered carries forward " +
  "to your next test-out.";

export async function runBuildTestOuts(opts: {
  teamRole: string;
  weeks: WeekSpec[];
  trainingModules?: TrainingModuleSpec[];
  testOutModules?: TestOutModuleSpec[];
  apply: boolean;
}) {
  const { teamRole, weeks, trainingModules = [], testOutModules = [], apply } = opts;

  const track = await db.getTrackByRole(teamRole);
  if (!track) throw new Error(`No training track found for teamRole "${teamRole}"`);

  const db2 = await db.getDb();
  if (!db2) throw new Error("Database unavailable");

  // Snapshot the current track structure (so a dry run shows what's already there).
  const existing = await db.getMilestonesByTrack(track.id);
  const currentStructure: any[] = [];
  for (const ms of existing) {
    const mods = await db.getModulesByMilestone(ms.id);
    currentStructure.push({
      id: ms.id,
      title: ms.title,
      weekNumber: ms.weekNumber,
      sortOrder: ms.sortOrder,
      isTestOut: isTestOut(ms.title),
      moduleCount: mods.length,
    });
  }

  let maxSort = existing.reduce((m, x) => Math.max(m, x.sortOrder ?? 0), 0);

  const plan: any[] = [];
  for (const wk of weeks) {
    const msTitle = `Week ${wk.week} Test Out — ${wk.theme}`;
    const existingMs = existing.find(m => m.title === msTitle);
    let milestoneId: number | null = existingMs?.id ?? null;
    let milestoneStatus: "exists" | "created" | "would create" = existingMs
      ? "exists"
      : apply
        ? "created"
        : "would create";

    if (!existingMs) {
      maxSort += 1;
      if (apply) {
        const [r] = await db2.insert(milestonesTable).values({
          trackId: track.id,
          title: msTitle,
          description: `Weekly test-out for Week ${wk.week}. Each skill is graded Mastered / Needs improvement.`,
          weekNumber: wk.week,
          sortOrder: maxSort,
        });
        milestoneId = (r as any).insertId;
      }
    }

    // Idempotency within the milestone: skip a skill that already exists by title.
    const existingMods = milestoneId ? await db.getModulesByMilestone(milestoneId) : [];
    const existingTitles = new Set(existingMods.map(m => m.title.toLowerCase()));
    let maxModSort = existingMods.reduce((m, x) => Math.max(m, x.sortOrder ?? 0), 0);

    const skillPlan: { title: string; status: "exists" | "created" | "would create" }[] = [];
    for (const skill of wk.skills) {
      if (existingTitles.has(skill.toLowerCase())) {
        skillPlan.push({ title: skill, status: "exists" });
        continue;
      }
      if (apply && milestoneId) {
        maxModSort += 1;
        await db2.insert(modulesTable).values({
          milestoneId,
          title: skill,
          type: "task",
          description: null,
          taskInstructions: GRADE_NOTE,
          sortOrder: maxModSort,
          isRequired: true,
          quizEnabled: false,
        });
        skillPlan.push({ title: skill, status: "created" });
      } else {
        skillPlan.push({ title: skill, status: "would create" });
      }
    }

    plan.push({
      week: wk.week,
      milestoneTitle: msTitle,
      milestoneId,
      milestoneStatus,
      skills: skillPlan,
    });
  }

  // Regular training modules: add each to the existing (non-test-out) training
  // milestone for its week. Idempotent by title within that milestone.
  const trainingPlan: any[] = [];
  for (const tm of trainingModules) {
    const target = existing.find(m => m.weekNumber === tm.week && !isTestOut(m.title));
    if (!target) {
      trainingPlan.push({
        week: tm.week,
        title: tm.title,
        status: "no training milestone for week",
        milestoneId: null,
        milestoneTitle: null,
      });
      continue;
    }
    const mods = await db.getModulesByMilestone(target.id);
    const exists = mods.some(m => m.title.toLowerCase() === tm.title.toLowerCase());
    let status: "exists" | "created" | "would create";
    if (exists) {
      status = "exists";
    } else if (apply) {
      const maxModSort = mods.reduce((m, x) => Math.max(m, x.sortOrder ?? 0), 0);
      await db2.insert(modulesTable).values({
        milestoneId: target.id,
        title: tm.title,
        type: tm.type ?? "task",
        description: tm.description ?? null,
        taskInstructions: tm.instructions ?? null,
        sortOrder: maxModSort + 1,
        isRequired: true,
        quizEnabled: false,
      });
      status = "created";
    } else {
      status = "would create";
    }
    trainingPlan.push({
      week: tm.week,
      title: tm.title,
      status,
      milestoneId: target.id,
      milestoneTitle: target.title,
    });
  }

  // A single graded skill dropped into an existing week's test-out. Unlike
  // weeks[] (which builds a chain from scratch and appends) this reuses the
  // week's own test-out whatever it is titled, and when the week has none it
  // inserts one in week order so the unlock chain stays in sequence.
  const testOutPlan: any[] = [];
  if (testOutModules.length) {
    const current = (await db.getMilestonesByTrack(track.id)).map(m => ({
      id: m.id,
      title: m.title,
      weekNumber: m.weekNumber,
    }));
    for (const tm of testOutModules) {
      const slot = planTestOutSlot(current, tm.week);
      let milestoneId: number | null = null;
      let milestoneTitle = `Week ${tm.week} Test Out`;
      let milestoneStatus: "exists" | "created" | "would create";

      if (slot.kind === "existing") {
        milestoneId = slot.milestoneId;
        milestoneTitle = current.find(m => m.id === milestoneId)!.title;
        milestoneStatus = "exists";
      } else if (apply) {
        const [r] = await db2.insert(milestonesTable).values({
          trackId: track.id,
          title: milestoneTitle,
          description: `Weekly test-out for Week ${tm.week}. Each skill is graded Mastered / Needs improvement.`,
          weekNumber: tm.week,
          sortOrder: slot.index + 1,
        });
        milestoneId = (r as any).insertId as number;
        current.splice(slot.index, 0, { id: milestoneId, title: milestoneTitle, weekNumber: tm.week });
        // Renumber the track so the new milestone holds its week's position
        // rather than landing at the end of the unlock chain.
        for (let i = 0; i < current.length; i++) {
          await db2.update(milestonesTable).set({ sortOrder: i + 1 }).where(eq(milestonesTable.id, current[i].id));
        }
        milestoneStatus = "created";
      } else {
        milestoneStatus = "would create";
      }

      let status: "exists" | "created" | "would create" = "would create";
      if (milestoneId) {
        const mods = await db.getModulesByMilestone(milestoneId);
        if (mods.some(m => m.title.toLowerCase() === tm.title.toLowerCase())) {
          status = "exists";
        } else if (apply) {
          const maxModSort = mods.reduce((mx, x) => Math.max(mx, x.sortOrder ?? 0), 0);
          await db2.insert(modulesTable).values({
            milestoneId,
            title: tm.title,
            type: "task",
            description: tm.description ?? null,
            taskInstructions: tm.instructions ?? GRADE_NOTE,
            sortOrder: maxModSort + 1,
            isRequired: true,
            quizEnabled: false,
          });
          status = "created";
        }
      }

      testOutPlan.push({
        week: tm.week,
        title: tm.title,
        status,
        milestoneId,
        milestoneTitle,
        milestoneStatus,
      });
    }
  }

  return {
    track: { id: track.id, name: track.name, teamRole: track.teamRole },
    applied: apply,
    currentStructure,
    plan,
    trainingModules: trainingPlan,
    testOutModules: testOutPlan,
  };
}
