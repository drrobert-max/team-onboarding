/**
 * Rebuilds the CA and Scan Tech tracks from the CHD Scan Tech Master Monday.com export.
 * Run: node server/seed-chd-tracks.mjs
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

async function run(sql, params = []) {
  const [rows] = await conn.execute(sql, params);
  return rows;
}

console.log("🔄 Rebuilding CA and Scan Tech tracks from CHD board...\n");

// Get track IDs
const tracks = await run("SELECT id, teamRole FROM tracks WHERE teamRole IN ('ca', 'scan_tech')");
const caTrackId = tracks.find(t => t.teamRole === 'ca')?.id;
const scanTechTrackId = tracks.find(t => t.teamRole === 'scan_tech')?.id;

if (!caTrackId || !scanTechTrackId) {
  console.error("❌ CA or Scan Tech track not found.");
  process.exit(1);
}
console.log(`✅ CA track ID: ${caTrackId}, Scan Tech track ID: ${scanTechTrackId}`);

// Clear existing milestones/modules for both tracks
for (const trackId of [caTrackId, scanTechTrackId]) {
  await run("DELETE FROM modules WHERE milestoneId IN (SELECT id FROM milestones WHERE trackId = ?)", [trackId]);
  await run("DELETE FROM milestones WHERE trackId = ?", [trackId]);
}
console.log("🗑️  Cleared existing milestones and modules for CA and Scan Tech\n");

// Full track structure parsed from CHD Scan Tech Master board
const trackData = [
  {
    title: "Week One",
    weekNumber: 1,
    dueDay: 7,
    description: "Orientation, shadowing, software setup, and foundational culture",
    modules: [
      { title: "Finish Gusto Checklist", description: "Complete all required HR onboarding items in Gusto.", type: "task" },
      { title: "Shadow — See Comments", description: "Shadow team members across all appointment types. Observe the full flow of the office.", type: "task" },
      { title: "Watch 'Start Here' Videos", description: "Watch the foundational orientation videos for all new team members.", type: "video", loomUrl: "https://www.loom.com/share/a1f55e7493414ad1a07749b0981e5ffc" },
      { title: "Introducing Yourself to Practice Members", description: "Learn the proper way to introduce yourself to new and existing practice members.", type: "task" },
      { title: "Watch Monday Board Basics Video", description: "Learn how to navigate and use the Monday.com onboarding board.", type: "video", loomUrl: "https://www.loom.com/share/a75159432b7e4d0bb5222b1cdf426beb" },
      { title: "CA Onboarding Program Team Members Video 1", description: "Watch Video 1 of the CA Onboarding Program. Log in to Circle via LastPass — see comments for access.", type: "video" },
      { title: "Start 'What the Heck is EOS'", description: "Begin reading the EOS book. Must be finished by the end of training.", type: "task" },
      { title: "Establish Access to Company Software", description: "Get set up with all required logins: SKED, IntakeQ, Fortis, Synapse, ChiroHD, Monday.com, etc.", type: "task" },
      { title: "Schedule Weekly Check-ins / 90-Day Eval", description: "Book recurring weekly check-ins with your supervisor and schedule your 90-day evaluation.", type: "task" },
      { title: "Start Memorizing Day 1 Education", description: "Begin memorizing the Day 1 Education script. Due by Week 7.", type: "task" },
      { title: "Watch Core Values Video", description: "Watch the Reformation Chiropractic Core Values video and begin memorizing.", type: "video", loomUrl: "https://www.loom.com/share/890f119ed00047b6a4e13aff11790397" },
      { title: "Watch Mission, Vision, Purpose", description: "Watch the Mission, Vision, and Purpose video and begin memorizing.", type: "task" },
    ]
  },
  {
    title: "Week 1 Check-In",
    weekNumber: 1,
    dueDay: 7,
    description: "End-of-week review with supervisor",
    modules: [
      { title: "Review Expectations from This Week", description: "Review what was expected of you this week with your supervisor.", type: "task" },
      { title: "Expectations for Next Week", description: "Discuss and confirm expectations for Week 2.", type: "task" },
    ]
  },
  {
    title: "Week Two",
    weekNumber: 2,
    dueDay: 14,
    description: "ChiroHD, SKED, CLA intro, and office flow",
    modules: [
      { title: "Start ChiroHD Academy", description: "Begin ChiroHD Academy training. See comments for required modules: Users/Providers/Calendars, User Preferences, ChiroHD Subscription.", type: "task" },
      { title: "Watch Office Flow (7 mins)", description: "Watch the Office Flow training video.", type: "video", loomUrl: "https://www.loom.com/share/5f3d9d4dc4cd47e7aabd3787d6f7e460" },
      { title: "Get Familiar with SKED — Respond to Texts", description: "Learn SKED basics and begin responding to patient texts. Watch SKED training videos.", type: "video", loomUrl: "https://skedlife.zendesk.com/hc/en-us" },
      { title: "CLA Intro Videos (30 mins)", description: "Watch the CLA Introduction module and 7 short intro lessons (~30 mins total).", type: "video", loomUrl: "https://www.insightclaacademy.com" },
      { title: "Watch CLA Videos — Thermal and HRV (30 mins)", description: "Complete the CLA Academy thermal and HRV training videos.", type: "video", loomUrl: "https://www.insightclaacademy.com" },
      { title: "Send Re-Eval Forms on IntakeQ (9 mins)", description: "Learn how to send re-evaluation forms through IntakeQ.", type: "video", loomUrl: "https://www.loom.com/share/d85379ed73a6409dbaced38ff414eb4b" },
      { title: "CLA Scanning — Practice Thermal & HRV with Team", description: "Practice thermal and HRV scanning on team members.", type: "task" },
      { title: "Watch Day 1 & Day 2 VA Tracker", description: "Watch the VA tracker training videos for Day 1 and Day 2.", type: "video", loomUrl: "https://www.loom.com/share/e811c1370b68483c8e2b85aee0ba66ee" },
      { title: "Watch Office Flow — New Patient Appointment (Shadowing)", description: "Shadow new patient appointments to understand the full office flow.", type: "task" },
      { title: "Watch Daily Checklist (13 mins)", description: "Watch the Daily Checklist training video.", type: "video", loomUrl: "https://www.loom.com/share/1f18e35117c14527ad21f5e54bb54e94" },
      { title: "Practice Day 1 Education with Team Member", description: "Practice delivering Day 1 Education with a team member.", type: "task" },
      { title: "Memorize Core Values", description: "Memorize the Reformation Chiropractic Core Values.", type: "task" },
      { title: "Watch Care Plan Guide (12 mins)", description: "Watch the Care Plan Guide training video.", type: "video", loomUrl: "https://www.loom.com/share/898ecc969d304f57b9e988be5dc4dd57" },
    ]
  },
  {
    title: "Week 2 Test Out",
    weekNumber: 2,
    dueDay: 14,
    description: "End-of-week competency check",
    modules: [
      { title: "Scan Thermal (Correct Procedures)", description: "Demonstrate correct thermal scanning procedures.", type: "task" },
      { title: "Scan HRV", description: "Demonstrate correct HRV scanning procedures.", type: "task" },
      { title: "SKED Basic Features Demo", description: "Demonstrate proficiency with SKED basic features.", type: "task" },
      { title: "ChiroHD — Basic Navigation", description: "Demonstrate calendar views, rescheduling, and adding appointments.", type: "task" },
      { title: "Teach Back Core Values", description: "Recite the Core Values from memory.", type: "task" },
      { title: "Explain the Differences in Care Plans", description: "Explain CCP, Wellness (1.0, 2.0, 3.0), PCP, and Fortify plans for neurodivergence.", type: "task" },
    ]
  },
  {
    title: "Week Three",
    weekNumber: 3,
    dueDay: 21,
    description: "ChiroHD Academy, CLA sEMG, VA trackers, and phone script",
    modules: [
      { title: "ChiroHD Academy (30 mins)", description: "Complete required ChiroHD Academy modules: Location Settings, Generic Day 1/2/3 overview, Location Utilities, Patient Profile.", type: "task" },
      { title: "Practice Creating Synapse CLA Reports", description: "Practice generating CLA reports in Synapse.", type: "task" },
      { title: "Watch CLA Videos — NeuroCore (15 mins)", description: "Complete the CLA Academy NeuroCore training videos.", type: "video", loomUrl: "https://www.insightclaacademy.com" },
      { title: "CLA Scanning — Practice sEMG with Team Member", description: "Practice sEMG scanning on a team member.", type: "task" },
      { title: "Watch Monday.com End of Day Reports (20 mins)", description: "Watch the Monday.com end-of-day reports training video.", type: "video", loomUrl: "https://www.loom.com/share/ea461a87602341a9b475bf2fec397ef9" },
      { title: "Watch Alerts (30 mins)", description: "Watch the Alerts training video.", type: "video", loomUrl: "https://www.loom.com/share/eb7159d8fb61462ca4129db7d9505842" },
      { title: "Scan Thermal and HRV on Practice Members", description: "Perform thermal and HRV scans on actual practice members.", type: "task" },
      { title: "Watch 'Day 1 VA Tracker' (13 mins)", description: "Watch the Day 1 VA Tracker training video.", type: "video", loomUrl: "https://www.loom.com/share/f9f77525aa4642439b6c9cbdfb46e261" },
      { title: "Watch E1 & E2 Scan Structure (4 mins)", description: "Watch the E1 and E2 scan structure training video.", type: "video", loomUrl: "https://www.loom.com/share/568140b0cccd4f8397e3629795c7578f" },
      { title: "Start Memorizing Phone Script", description: "Begin memorizing the phone script for incoming and outgoing calls.", type: "task" },
    ]
  },
  {
    title: "Week 3 Test Out",
    weekNumber: 3,
    dueDay: 21,
    description: "End-of-week competency check",
    modules: [
      { title: "Generate All CLA Reports Based on Data Given", description: "Demonstrate ability to generate all CLA report types from given data.", type: "task" },
      { title: "Complete Accurate Thermal Scans on Practice Members", description: "Perform accurate thermal scans independently.", type: "task" },
      { title: "Explain E1 & E2 Structure", description: "Explain the E1 and E2 scan structure from memory.", type: "task" },
      { title: "ChiroHD — Go Through Patient Profile", description: "Explain the purpose of each section in the patient snapshot and each tab in the profile.", type: "task" },
      { title: "Explain Process for Scanning sEMG with Correct Procedures", description: "Demonstrate and explain correct sEMG scanning procedures.", type: "task" },
    ]
  },
  {
    title: "Week Four",
    weekNumber: 4,
    dueDay: 28,
    description: "ChiroHD reporting, VA trackers, phone calls, and Fortis",
    modules: [
      { title: "ChiroHD — Reporting", description: "Complete ChiroHD reporting training: All Reports, System Level Reporting, Financial Tab, Metrics Dashboard, Appointment Metrics, Advanced Patient Search, Simple Reporting (all 15 modules).", type: "task" },
      { title: "Watch 'Managing Payments & Fortis'", description: "Watch the Fortis payment management training video.", type: "video", loomUrl: "https://www.loom.com/share/e35a77506bc74b02b58861383da3bd4f" },
      { title: "Practicing Phone Script", description: "Practice the phone script with team members.", type: "task" },
      { title: "Make Calls — Missed Visits Report Next Day", description: "Begin making outbound calls for missed visits using the next-day report.", type: "task" },
      { title: "Watch Day 2 VA Tracker (17 mins)", description: "Watch the Day 2 VA Tracker training video.", type: "video", loomUrl: "https://www.loom.com/share/9522c7f7b70744ce815e9b7218ba58ea" },
      { title: "Watch Re-Eval VA Tracker (10 mins)", description: "Watch the Re-Eval VA Tracker training video.", type: "video", loomUrl: "https://www.loom.com/share/875b0d4c9a2a462e91ec3d1b7642f23f" },
      { title: "Watch HR VA Tracker (14 mins)", description: "Watch the Health Review VA Tracker training video.", type: "video", loomUrl: "https://www.loom.com/share/c5e78d4873ca4ed580ae12a3e24b16f3" },
      { title: "Watch Ideal Client — Dr. Rob", description: "Watch the Ideal Client training video from Dr. Rob.", type: "task" },
      { title: "Scan sEMG on Practice Members (Supervised for Re-Evals)", description: "Perform sEMG scans on practice members under supervision for re-evaluations.", type: "task" },
    ]
  },
  {
    title: "Week 4 Test Out",
    weekNumber: 4,
    dueDay: 28,
    description: "End-of-week competency check",
    modules: [
      { title: "Complete All VA Trackers Accurately", description: "Demonstrate proficiency with all VA trackers.", type: "task" },
      { title: "Phone Script Proficiency", description: "Demonstrate phone script proficiency.", type: "task" },
      { title: "ChiroHD Reporting Demo", description: "Demonstrate ChiroHD reporting capabilities.", type: "task" },
    ]
  },
  {
    title: "Week Five",
    weekNumber: 5,
    dueDay: 35,
    description: "Platinum basics, tours, and care plan financials",
    modules: [
      { title: "Watch 'Platinum Basics' Video", description: "Watch the Platinum Basics training video with attention to this week's goals.", type: "video", loomUrl: "https://www.loom.com/share/a77f5a1ffdbe4382a652faca605ddf35" },
      { title: "Give Tours All Week", description: "Practice giving office tours throughout the week.", type: "task" },
      { title: "Watch 'Care Plans and Financials' Video", description: "Watch the Care Plans and Financials training video.", type: "video", loomUrl: "https://www.loom.com/share/d7136c15e872431196a9faa7126b7e9f" },
      { title: "Fortis — Day 1 Payment & Split Payment", description: "Learn how to process Day 1 payments and split payments in Fortis.", type: "task" },
      { title: "Watch AMPED Day 1 Education (25 mins)", description: "Log in to Circle via LastPass → AMPED Team Modules → AMPED Systems and Procedures → Lesson 3 (videos 1 and 2).", type: "task" },
      { title: "Pediatric Experience", description: "Log in via LastPass → click 02 | Clinical Care + Results → complete PX + Insight Neuro-Scanning Systems (7 videos).", type: "task" },
      { title: "Watch AMPED Office Tours", description: "Log in to Circle via LastPass → AMPED Team Modules → Office Tours Lesson 2 (2 updated training videos).", type: "task" },
      { title: "Watch AMPED Day 1 Close", description: "Log in to Circle via LastPass → AMPED Team Modules → Lesson 5 (4 updated training videos).", type: "task" },
    ]
  },
  {
    title: "Week 5 Test Out",
    weekNumber: 5,
    dueDay: 35,
    description: "End-of-week competency check",
    modules: [
      { title: "Give Office Tour Independently", description: "Demonstrate ability to give a complete office tour independently.", type: "task" },
      { title: "Explain Care Plan Options", description: "Explain all care plan options and financials accurately.", type: "task" },
      { title: "Fortis Payment Processing", description: "Demonstrate Fortis payment processing.", type: "task" },
    ]
  },
  {
    title: "Week Six",
    weekNumber: 6,
    dueDay: 42,
    description: "New patient process, special codes, and objections intro",
    modules: [
      { title: "New Patient (N Code) — Learn and Shadow", description: "Shadow new patient appointments and learn the N code process end-to-end.", type: "task" },
      { title: "Watch 'Objections' Video", description: "Watch the Objections training video.", type: "video", loomUrl: "https://www.loom.com/share/4f584f65494a4d298848c9dc78f32d98" },
      { title: "Watch 'Phones' Video", description: "Watch the Phones training video.", type: "video", loomUrl: "https://www.loom.com/share/158784ad07b3449e8a22879cf85cc158" },
      { title: "V Code — Learn How to Do", description: "Learn the V code process end-to-end.", type: "task" },
      { title: "Re-assessment (2 Code) — Learn, Shadow, Generate Reports", description: "Shadow 2-code re-assessments and practice generating reports.", type: "task" },
      { title: "Watch AMPED Progress Report of Findings", description: "Log in to Circle via LastPass → AMPED Team Modules → Lesson 15 (videos 1 and 3; ignore financial details in video 3).", type: "task" },
    ]
  },
  {
    title: "Week 6 Test Out",
    weekNumber: 6,
    dueDay: 42,
    description: "End-of-week competency check",
    modules: [
      { title: "N Code Process — Demonstrate", description: "Demonstrate the new patient (N code) process from start to finish.", type: "task" },
      { title: "Objections — Demonstrate", description: "Demonstrate responses to common objections.", type: "task" },
      { title: "2-Code Re-assessment Report", description: "Generate a complete 2-code re-assessment report.", type: "task" },
    ]
  },
  {
    title: "Week Seven",
    weekNumber: 7,
    dueDay: 49,
    description: "Day 1 Education mastery, NPM appointments, and AMPED",
    modules: [
      { title: "Proficient at All Special Codes (N, V, F, 2, B)", description: "Perform and document all special codes independently.", type: "task" },
      { title: "Begin Learning Objections", description: "Practice all objection responses.", type: "task" },
      { title: "CA Onboarding Program Team Members Video 3", description: "Watch CA Onboarding Program Video 3.", type: "video" },
      { title: "Practice Day 1 Education", description: "Practice delivering the full Day 1 Education presentation.", type: "task" },
      { title: "AMPED Day 1 Education (25 mins)", description: "Complete AMPED Day 1 Education module in Circle.", type: "task" },
    ]
  },
  {
    title: "Week 7 Test Out",
    weekNumber: 7,
    dueDay: 49,
    description: "End-of-week competency check",
    modules: [
      { title: "Day 1 Education — Full Delivery", description: "Deliver the full Day 1 Education presentation from memory.", type: "task" },
      { title: "NPM Appointment — Start to Finish", description: "Complete a new patient appointment start to finish.", type: "task" },
      { title: "Objection Responses", description: "Demonstrate responses to all standard objections.", type: "task" },
    ]
  },
  {
    title: "Week Eight",
    weekNumber: 8,
    dueDay: 56,
    description: "Objections mastery, VA tracker proficiency, and discontinuation",
    modules: [
      { title: "Proficient at Objections — Watch AMPED In-Office Objections", description: "Achieve full objections proficiency. Complete AMPED In-Office Objections module.", type: "task" },
      { title: "Proficient at All VA Trackers (Timed)", description: "Complete all VA trackers accurately within the expected time.", type: "task" },
      { title: "Discontinuation Verbiage & Process", description: "Learn the discontinuation verbiage and process.", type: "task" },
      { title: "CA Onboarding Program Team Members Video 4", description: "Watch CA Onboarding Program Video 4.", type: "video" },
      { title: "Watch AMPED Office Tours", description: "Complete the AMPED Office Tours module in Circle.", type: "task" },
    ]
  },
  {
    title: "60-Day Expectations",
    weekNumber: 8,
    dueDay: 60,
    description: "Competency benchmarks expected by day 60",
    modules: [
      { title: "Perform Day 1 Appointment Independently", description: "Complete a full Day 1 appointment from start to finish without assistance.", type: "task" },
      { title: "Understand Care Plans & Billing", description: "Able to answer questions about care plans and look at a patient ledger accurately.", type: "task" },
      { title: "Perform Day 2 Appointment & Build Out Care Plan", description: "Complete a Day 2 appointment and build out the care plan independently.", type: "task" },
      { title: "Perform All Re-Evaluation Appointments Including ND", description: "Complete all re-evaluation appointment types independently, including neurodivergent.", type: "task" },
      { title: "Answer Questions Over the Phone & Schedule Phone Consult", description: "Handle incoming calls and schedule phone consultations independently.", type: "task" },
      { title: "Perform Health Review Appointment Independently", description: "Complete a health review appointment independently.", type: "task" },
      { title: "Complete Entire Opening Checklist & Monday End-of-Day Checklist", description: "Complete both the opening checklist and Monday end-of-day checklist without assistance.", type: "task" },
    ]
  },
  {
    title: "Week 8 Test Out",
    weekNumber: 8,
    dueDay: 56,
    description: "End-of-week competency check",
    modules: [
      { title: "VA Tracker Proficiency (In & Out of Office Tasks)", description: "Demonstrate full VA tracker proficiency including out-of-office tasks.", type: "task" },
      { title: "Discontinuation Verbiage & Process", description: "Demonstrate discontinuation verbiage and process.", type: "task" },
    ]
  },
  {
    title: "Week Nine",
    weekNumber: 9,
    dueDay: 63,
    description: "NPM proficiency, records requests, and Video 5",
    modules: [
      { title: "Proficient NPM Appointments — Day 1 and Day 2", description: "Demonstrate full proficiency with new patient (Day 1) and first adjustment (Day 2) appointments.", type: "task" },
      { title: "Records Requests", description: "Learn the records request process.", type: "task" },
      { title: "CA Onboarding Program Team Members Video 5", description: "Watch CA Onboarding Program Video 5.", type: "video" },
    ]
  },
  {
    title: "Week Ten",
    weekNumber: 10,
    dueDay: 70,
    description: "Screenings, Video 6, and Monday daily checklist",
    modules: [
      { title: "Watch 'Screening' Video", description: "Watch the Screening training video.", type: "video", loomUrl: "https://www.loom.com/share/40e75bde6c0e4f968c416671ebf6ac55" },
      { title: "CA Onboarding Program Team Members Video 6", description: "Watch CA Onboarding Program Video 6.", type: "video" },
      { title: "Proficient at Monday Daily Checklist", description: "Complete the Monday daily checklist without assistance.", type: "task" },
      { title: "Pediatric Experience", description: "Complete the Pediatric Experience module in Circle.", type: "task" },
    ]
  },
  {
    title: "Week Eleven",
    weekNumber: 11,
    dueDay: 77,
    description: "Insurance and AMPED Day 1 Close",
    modules: [
      { title: "Watch 'Insurance' Video", description: "Watch the Insurance training video.", type: "video", loomUrl: "https://www.loom.com/share/81d6dd01602f4d4fb94ec28bbfcfc509" },
      { title: "Watch AMPED Day 1 Close", description: "Complete the AMPED Day 1 Close module in Circle.", type: "task" },
    ]
  },
  {
    title: "Week Twelve",
    weekNumber: 12,
    dueDay: 84,
    description: "EOS completion, AMPED Progress ROF, and problem solving",
    modules: [
      { title: "Finish 'What the Heck is EOS'", description: "Complete reading the EOS book.", type: "task" },
      { title: "Watch AMPED Progress Report of Findings", description: "Complete the AMPED Progress Report of Findings module in Circle.", type: "task" },
      { title: "Watch Problem Solving (VA Edition)", description: "Watch the Problem Solving VA Edition training video.", type: "video", loomUrl: "https://www.loom.com/share/42cae4b335d0447d94bddc325952b81f" },
    ]
  },
];

// Insert milestones and modules for both tracks
async function seedTrack(trackId, trackName) {
  let totalModules = 0;
  for (const [mIdx, milestone] of trackData.entries()) {
    const [milestoneResult] = await conn.execute(
      `INSERT INTO milestones (trackId, title, description, weekNumber, dueDay, sortOrder, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [trackId, milestone.title, milestone.description, milestone.weekNumber, milestone.dueDay ?? null, mIdx + 1]
    );
    const milestoneId = milestoneResult.insertId;

    for (const [modIdx, mod] of milestone.modules.entries()) {
      await conn.execute(
        `INSERT INTO modules (milestoneId, title, description, type, loomUrl, sortOrder, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [milestoneId, mod.title, mod.description, mod.type, mod.loomUrl ?? null, modIdx + 1]
      );
      totalModules++;
    }
  }
  console.log(`✅ ${trackName}: ${trackData.length} milestones, ${totalModules} modules`);
}

await seedTrack(caTrackId, "CA Track");
await seedTrack(scanTechTrackId, "Scan Tech Track");

console.log("\n✅ Both tracks rebuilt successfully.");
await conn.end();
