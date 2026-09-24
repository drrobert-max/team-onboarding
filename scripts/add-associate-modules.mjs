/**
 * One-off content change: add the EOS book and the Skool course to the
 * Associate Doctor track.
 *
 *   Week 2 (training)  — "Start Reading \"What the Heck is EOS\""
 *   Week 2 (training)  — "Start 12 week Course in Skool"
 *   Week 7 (test out)  — "Complete What the Heck is EOS"
 *
 * Posts to the SETUP_SECRET-gated /api/admin/build-testouts endpoint on the
 * live site, so it needs no database access. Dry run by default: it prints the
 * track's current weeks and what it would create. Add --apply to write.
 * Re-running is safe — an item that already exists is reported, never doubled.
 *
 *   SETUP_SECRET=... node scripts/add-associate-modules.mjs
 *   SETUP_SECRET=... node scripts/add-associate-modules.mjs --apply
 */
const BASE_URL = process.env.BASE_URL ?? "https://team-onboarding-production.up.railway.app";
const SECRET = process.env.SETUP_SECRET;
const apply = process.argv.includes("--apply");

if (!SECRET) {
  console.error("SETUP_SECRET is required (Railway → team-onboarding → Variables).");
  process.exit(1);
}

const payload = {
  teamRole: "associate_doctor",
  weeks: [],
  trainingModules: [
    {
      week: 2,
      title: 'Start Reading "What the Heck is EOS"',
      description: "Begin reading the EOS book. Finish it by your Week 7 test-out.",
      type: "task",
    },
    {
      week: 2,
      title: "Start 12 week Course in Skool",
      description: "Enroll in the 12-week course in Skool and begin working through it.",
      type: "task",
    },
  ],
  testOutModules: [
    {
      week: 7,
      title: "Complete What the Heck is EOS",
      instructions:
        "Confirm with your supervising doctor that you have finished \"What the Heck is EOS\" " +
        "and can talk through the core concepts. Graded Mastered / Needs improvement.",
    },
  ],
  apply,
};

const res = await fetch(`${BASE_URL}/api/admin/build-testouts`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-setup-secret": SECRET },
  body: JSON.stringify(payload),
});
const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
if (!res.ok || body.ok === false) {
  console.error("Failed:", body);
  process.exit(1);
}

console.log(`Track: ${body.track.name} (${body.track.teamRole})\n`);
console.log("Current weeks:");
for (const ms of body.currentStructure) {
  console.log(`  ${String(ms.weekNumber).padStart(3)}  ${ms.isTestOut ? "[test out]" : "[training]"} ${ms.title} — ${ms.moduleCount} modules`);
}
console.log(`\n${apply ? "Applied" : "Dry run (add --apply to write)"}:`);
for (const t of body.trainingModules) {
  console.log(`  week ${t.week} training — "${t.title}": ${t.status}${t.milestoneTitle ? ` (in "${t.milestoneTitle}")` : ""}`);
}
for (const t of body.testOutModules) {
  console.log(`  week ${t.week} test out — "${t.title}": ${t.status} (milestone "${t.milestoneTitle}" ${t.milestoneStatus})`);
}
