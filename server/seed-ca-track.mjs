/**
 * Rebuilds the CA onboarding track from the Monday.com export.
 * Run: node server/seed-ca-track.mjs
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq, and } from "drizzle-orm";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn);

// ── Schema imports (inline to avoid TS compilation) ─────────────────────────
// We'll use raw SQL for simplicity in this seed script

async function run(sql, params = []) {
  const [rows] = await conn.execute(sql, params);
  return rows;
}

async function query(sql, params = []) {
  const [rows] = await conn.execute(sql, params);
  return rows;
}

console.log("🔄 Rebuilding CA track from Monday.com data...\n");

// 1. Get the CA track ID
const tracks = await query("SELECT id FROM tracks WHERE teamRole = 'ca' LIMIT 1");
if (!tracks.length) {
  console.error("❌ CA track not found. Run the main seed first.");
  process.exit(1);
}
const caTrackId = tracks[0].id;
console.log(`✅ CA track ID: ${caTrackId}`);

// 2. Delete existing milestones + modules for CA track (cascade)
await run("DELETE FROM modules WHERE milestoneId IN (SELECT id FROM milestones WHERE trackId = ?)", [caTrackId]);
await run("DELETE FROM milestones WHERE trackId = ?", [caTrackId]);
console.log("🗑️  Cleared existing CA milestones and modules");

// 3. Define the exact CA track from Monday.com export
const caTrack = [
  {
    title: "Week One",
    description: "Orientation, shadowing, and foundational setup",
    weekNumber: 1,
    dueDay: 7,
    modules: [
      { title: "Shadow Adjustments", description: "Observe and shadow chiropractic adjustments in the office.", type: "task" },
      { title: "Shadow New Patients", description: "Observe new patient exams and intake process.", type: "task" },
      { title: "Shadow Re-Evals", description: "Observe re-evaluation appointments.", type: "task" },
      { title: "Watch 'Start Here' Videos", description: "Watch the foundational orientation videos for new team members.", type: "video", loomUrl: "https://www.loom.com/share/a1f55e7493414ad1a07749b0981e5ffc" },
      { title: "Introducing Yourself to New Practice Members", description: "Learn the proper way to introduce yourself to new practice members.", type: "task" },
      { title: "Watch Monday Board Basics Video", description: "Learn how to use the Monday.com board for tracking your onboarding.", type: "video", loomUrl: "https://www.loom.com/share/44ca59217bc945a990577c8d4c6b6b93" },
      { title: "CA Onboarding Program Team Members Video 1", description: "Watch the first CA Onboarding Program video (log in to Circle via LastPass — see Selena).", type: "video" },
      { title: "Start 'What the Heck is EOS'", description: "Begin reading the EOS book assigned to all new team members.", type: "task" },
      { title: "Establish Access to Company Software", description: "Get set up with all required logins: SKED, IntakeQ, Fortis, Synapse, Monday.com, etc.", type: "task" },
      { title: "Schedule Weekly Check-ins / 90-Day Eval", description: "Book recurring weekly check-ins with your supervisor and schedule your 90-day evaluation.", type: "task" },
      { title: "Watch 'Day 1 & Day 2 VA Tracker'", description: "Learn the VA tracker workflows for Day 1 and Day 2 visits.", type: "video", loomUrl: "https://www.loom.com/share/e811c1370b68483c8e2b85aee0ba66ee", loomUrl2: "https://www.loom.com/share/1888993f5f3a4ac48f3593ac298b83d6" },
    ]
  },
  {
    title: "Week Two",
    description: "Platinum basics, tours, and communication systems",
    weekNumber: 2,
    dueDay: 14,
    modules: [
      { title: "Platinum — Initial Training (see note)", description: "Begin Platinum training. Focus on the basics for this week's goal.", type: "task" },
      { title: "Make Calls — Missed Visits & LS2 List", description: "Start making outbound calls for missed visits and the LS2 list.", type: "task" },
      { title: "Get Familiar with SKED — Respond to Texts", description: "Learn SKED and begin responding to patient texts.", type: "task" },
      { title: "Give Tours by End of Week (see note)", description: "Be able to give office tours independently by the end of Week 2.", type: "task" },
      { title: "Fortis — Day 1 Payment & Split Payment", description: "Learn how to process Day 1 payments and split payments in Fortis.", type: "task" },
      { title: "Send Re-Eval Forms on IntakeQ", description: "Learn how to send re-evaluation forms through IntakeQ.", type: "task" },
      { title: "Watch 'Platinum Basics' Video", description: "Watch the Platinum Basics training video with special attention to this week's goal.", type: "video", loomUrl: "https://www.loom.com/share/a77f5a1ffdbe4382a652faca605ddf35", loomUrl2: "https://www.loom.com/share/5d55db5f7c914ca39700729175dbe366" },
      { title: "Watch Re-Eval VA Tracker & HR VA Tracker", description: "Learn the VA tracker workflows for re-evals and health reports.", type: "video", loomUrl: "https://www.loom.com/share/b7cd7db3202548d39df20d12aa721b54", loomUrl2: "https://www.loom.com/share/2eb6c83e70ec465e8a276fc95f8ca898" },
    ]
  },
  {
    title: "Week Three",
    description: "Platinum proficiency, phones, and folder building",
    weekNumber: 3,
    dueDay: 21,
    modules: [
      { title: "Platinum — Continued Training (see note)", description: "Continue Platinum training. Focus on this week's specific goal.", type: "task" },
      { title: "Fortis — Continued Training (see note)", description: "Continue Fortis payment processing training.", type: "task" },
      { title: "Give Tours All Week", description: "Give office tours throughout the week to build proficiency.", type: "task" },
      { title: "Phones (Outgoing) — see note", description: "Begin outgoing phone call training. Review the phone SOP.", type: "task" },
      { title: "Build V Code Folders — Correct Content", description: "Build V code folders with the correct content per protocol.", type: "task" },
      { title: "Prep Wellness HR Reports", description: "Learn how to prepare Wellness Health Reports.", type: "task" },
      { title: "Watch 'Platinum Basics' Video (Week 3 Focus)", description: "Re-watch Platinum Basics with attention to this week's goal.", type: "video", loomUrl: "https://www.loom.com/share/a77f5a1ffdbe4382a652faca605ddf35", loomUrl2: "https://www.loom.com/share/5d55db5f7c914ca39700729175dbe366" },
      { title: "Watch 'Phones' Video", description: "Watch the Phones training video.", type: "video", loomUrl: "https://www.loom.com/share/158784ad07b3449e8a22879cf85cc158" },
      { title: "Prep N Code Silver Folder", description: "Prepare the N code Silver folder per protocol.", type: "task" },
      { title: "Practice Creating Synapse CLA Reports", description: "Practice generating CLA reports in Synapse.", type: "task" },
    ]
  },
  {
    title: "Week Four",
    description: "Platinum Part III, VA trackers, and CLA scanning introduction",
    weekNumber: 4,
    dueDay: 28,
    modules: [
      { title: "Platinum Part III — see note", description: "Complete Platinum Part III training.", type: "task" },
      { title: "Give Tours All Week", description: "Continue giving office tours throughout the week.", type: "task" },
      { title: "Proficient at All VA Trackers", description: "Achieve proficiency with all VA tracker workflows.", type: "task" },
      { title: "Phones (Incoming) — see note", description: "Begin incoming phone call training.", type: "task" },
      { title: "CLA Scanning — Begin Learning Thermal & HRV", description: "Start learning CLA scanning with a focus on thermal and HRV.", type: "task" },
      { title: "New Patient (N Code) — Learn How to Do (Shadowing)", description: "Shadow new patient appointments and learn the N code process.", type: "task" },
    ]
  },
  {
    title: "Week Five",
    description: "CLA scanning expansion and re-assessment introduction",
    weekNumber: 5,
    dueDay: 35,
    modules: [
      { title: "Watch CLA Videos — Thermal and HRV", description: "Complete the CLA Academy thermal and HRV training videos.", type: "video", loomUrl: "https://www.insightclaacademy.com" },
      { title: "CA Onboarding Program Team Members Video 2 (AMPED Video)", description: "Watch CA Onboarding Program Video 2 (AMPED module).", type: "video" },
      { title: "CLA Scanning — Begin Learning sEMG", description: "Expand CLA scanning training to include sEMG.", type: "task" },
      { title: "Watch CLA Videos — sEMG", description: "Complete the CLA Academy sEMG training videos.", type: "task" },
      { title: "Re-assessment (2 Code) — Learn, Shadow, Generate Reports", description: "Shadow 2-code re-assessments and practice generating reports.", type: "task" },
    ]
  },
  {
    title: "Week Six",
    description: "Special codes, CLA with practice members, and care plans",
    weekNumber: 6,
    dueDay: 42,
    modules: [
      { title: "V Code — Learn How to Do", description: "Learn the V code process end-to-end.", type: "task" },
      { title: "CLA Scanning — Continue Working on Thermal, HRV, sEMG", description: "Continue developing CLA scanning skills across all modalities.", type: "task" },
      { title: "Re-assessment (B Code) — Learn, Shadow", description: "Shadow B code re-assessments.", type: "task" },
      { title: "Watch 'Care Plans' Video", description: "Watch the Care Plans training video.", type: "video", loomUrl: "https://www.loom.com/share/d7136c15e872431196a9faa7126b7e9f", loomUrl2: "https://www.loom.com/share/87aad181e07a4a1da9e08e878e858ed7" },
    ]
  },
  {
    title: "Week Seven",
    description: "Special codes proficiency and objections introduction",
    weekNumber: 7,
    dueDay: 49,
    modules: [
      { title: "Work on All Special Codes (N, V, F, 2, B) — Perform and Document", description: "Practice performing and documenting all special codes independently.", type: "task" },
      { title: "CLA Scanning — Able to Do with Practice Member", description: "Perform CLA scanning independently with a practice member.", type: "task" },
      { title: "Begin Learning Objections", description: "Start studying and practicing objection handling scripts.", type: "task" },
      { title: "Watch 'Objections' Video", description: "Watch the Objections training video.", type: "video", loomUrl: "https://www.loom.com/share/4f584f65494a4d298848c9dc78f32d98" },
    ]
  },
  {
    title: "Week Eight",
    description: "CLA proficiency and objections mastery",
    weekNumber: 8,
    dueDay: 56,
    modules: [
      { title: "CLA Scanning — Able to Do with Practice Member", description: "Demonstrate consistent CLA scanning proficiency with practice members.", type: "task" },
      { title: "Re-assessment (2 Code & B Code) — Able to Do with Practice Members", description: "Perform 2-code and B-code re-assessments independently with practice members.", type: "task" },
      { title: "Proficient at Objections", description: "Demonstrate proficiency at handling all standard objections.", type: "task" },
    ]
  },
  {
    title: "Week Nine",
    description: "N codes, V codes, and continued development",
    weekNumber: 9,
    dueDay: 63,
    modules: [
      { title: "CA Onboarding Program Team Members Video 3", description: "Watch CA Onboarding Program Video 3.", type: "video" },
      { title: "Proficient at N Codes and V Codes", description: "Demonstrate full proficiency with N code and V code processes.", type: "task" },
    ]
  },
  {
    title: "Week Ten",
    description: "Screenings introduction",
    weekNumber: 10,
    dueDay: 70,
    modules: [
      { title: "Screenings — Start Learning", description: "Begin learning the screening process for community events.", type: "task" },
      { title: "Watch 'Screening' Video", description: "Watch the Screening training video.", type: "video", loomUrl: "https://www.loom.com/share/40e75bde6c0e4f968c416671ebf6ac55" },
    ]
  },
  {
    title: "Week Eleven",
    description: "Screening events and insurance",
    weekNumber: 11,
    dueDay: 77,
    modules: [
      { title: "Screening Events — Proficient by End of Week", description: "Achieve full proficiency at running screening events independently.", type: "task" },
      { title: "Watch 'Insurance' Video", description: "Watch the Insurance training video.", type: "video", loomUrl: "https://www.loom.com/share/81d6dd01602f4d4fb94ec28bbfcfc509" },
    ]
  },
  {
    title: "Week Twelve",
    description: "Final onboarding milestone",
    weekNumber: 12,
    dueDay: 84,
    modules: [
      { title: "CA Onboarding Program Team Members Video 4", description: "Watch CA Onboarding Program Video 4.", type: "video" },
    ]
  },
  {
    title: "Stretch Goals",
    description: "Advanced skills and additional training beyond the core 12-week program",
    weekNumber: 13,
    dueDay: null,
    modules: [
      { title: "Calling Insurance for Verifications", description: "Learn how to call insurance companies for benefit verifications.", type: "task" },
      { title: "CA Onboarding Program Team Members Video 5", description: "Watch CA Onboarding Program Video 5.", type: "video" },
      { title: "CA Onboarding Program Team Members Video 6", description: "Watch CA Onboarding Program Video 6.", type: "video" },
      { title: "Watch 'Full Checklist — Day One'", description: "Watch the full Day One checklist walkthrough video.", type: "video", loomUrl: "https://www.loom.com/share/4f5847fbe5aa4ed5be91683d18a1940b" },
      { title: "Watch 'Full Checklist — Day Two'", description: "Watch the full Day Two checklist walkthrough video.", type: "video", loomUrl: "https://www.loom.com/share/9aec03307a1048d98968be6e6cc2533c" },
    ]
  },
  {
    title: "AMPED Modules",
    description: "Required AMPED training program modules for all CAs",
    weekNumber: 14,
    dueDay: null,
    modules: [
      { title: "AMPED: Phones and the Front Office", description: "Complete the AMPED module on phones and front office operations.", type: "video" },
      { title: "AMPED: Office Tours", description: "Complete the AMPED module on giving office tours.", type: "video" },
      { title: "AMPED: Day 1 Education", description: "Complete the AMPED module on Day 1 patient education.", type: "video" },
      { title: "AMPED: The Evaluation", description: "Complete the AMPED module on the evaluation process.", type: "video" },
      { title: "AMPED: Doctor's Report 1.0 (Video 1 Only)", description: "Watch Video 1 of the AMPED Doctor's Report module.", type: "video" },
      { title: "AMPED: Care Plans and Financials (Video 4)", description: "Watch Video 4 of the AMPED Care Plans and Financials module.", type: "video" },
      { title: "AMPED: Care Plans and Financials — Bonus: The Save Part 1", description: "Watch the AMPED bonus video: The Save, Part 1.", type: "video" },
      { title: "AMPED: Care Plans and Financials — Bonus: The Save Part 2", description: "Watch the AMPED bonus video: The Save, Part 2.", type: "video" },
      { title: "AMPED: Reevaluations", description: "Complete the AMPED module on reevaluations.", type: "video" },
      { title: "AMPED: In-Office Objections", description: "Complete the AMPED module on handling in-office objections.", type: "video" },
      { title: "AMPED: In-Office Conversations and Education", description: "Complete the AMPED module on in-office conversations and patient education.", type: "video" },
      { title: "AMPED: Retention Steps", description: "Complete the AMPED module on patient retention steps.", type: "video" },
      { title: "AMPED: Philosophy in Practice", description: "Complete the AMPED module on chiropractic philosophy in practice.", type: "video" },
    ]
  }
];

// 4. Insert milestones and modules
let totalModules = 0;
for (const [mIdx, milestone] of caTrack.entries()) {
  const [milestoneResult] = await conn.execute(
    `INSERT INTO milestones (trackId, title, description, weekNumber, dueDay, sortOrder, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [caTrackId, milestone.title, milestone.description, milestone.weekNumber, milestone.dueDay ?? null, mIdx + 1]
  );
  const milestoneId = milestoneResult.insertId;
  console.log(`  ✅ Milestone: ${milestone.title} (ID: ${milestoneId})`);

  for (const [modIdx, mod] of milestone.modules.entries()) {
    await conn.execute(
      `INSERT INTO modules (milestoneId, title, description, type, loomUrl, loomUrl2, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [milestoneId, mod.title, mod.description, mod.type ?? "task", mod.loomUrl ?? null, mod.loomUrl2 ?? null, modIdx + 1]
    );
    totalModules++;
  }
  console.log(`     → ${milestone.modules.length} modules inserted`);
}

console.log(`\n✅ CA track rebuilt: 14 milestones, ${totalModules} modules total`);
await conn.end();
