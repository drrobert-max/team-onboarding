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
 * Idempotent: re-running skips a milestone that already exists (matched by
 * title) and skips any skill already present in it (matched by title). This
 * means a dry run (apply=false) and a later apply produce the same shape, and
 * re-applying never duplicates.
 */
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

const GRADE_NOTE =
  "Demonstrate this live to your supervising doctor during your weekly test-out. " +
  "Graded Mastered / Needs improvement — anything not yet mastered carries forward " +
  "to your next test-out.";

export async function runBuildTestOuts(opts: {
  teamRole: string;
  weeks: WeekSpec[];
  trainingModules?: TrainingModuleSpec[];
  apply: boolean;
}) {
  const { teamRole, weeks, trainingModules = [], apply } = opts;

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

  return {
    track: { id: track.id, name: track.name, teamRole: track.teamRole },
    applied: apply,
    currentStructure,
    plan,
    trainingModules: trainingPlan,
  };
}
