import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 1. Delete ALL old modules from weeks 5-7 (both tracks, created May 4)
const oldIds = [
  // CA
  226,227,229,231,232,
  233,234,
  237,238,241,
  243,
  245,246,247,248,249,
  250,251,252,
  // Scan Tech
  340,341,343,345,346,
  347,348,
  351,352,355,
  357,
  359,360,361,362,363,
  364,365,366
];

const [del] = await conn.query(`DELETE FROM modules WHERE id IN (${oldIds.join(',')})`);
console.log(`Deleted ${del.affectedRows} old modules`);

// Helper
const ins = async (row) => {
  await conn.query(
    'INSERT INTO modules (milestoneId, title, description, type, loomUrl, loomUrl2, sortOrder, isRequired) VALUES (?,?,?,?,?,?,?,1)',
    row
  );
  console.log(`  + [ms${row[0]}] ${row[1]}`);
};

// 2. CA Week 5 (ms=39) and Test Out (ms=40)
console.log('\nCA Week 5:');
await ins([39,'CA Onboarding Program Team Members Video 2 (AMPED Video)','Log in to Circle via LastPass and watch CA Onboarding Team Members Video 2.','video',null,null,1]);
await ins([39,'Cashpractice','Practice using Cashpractice for payment processing. See team notes for specific tasks.','task',null,null,2]);
await ins([39,'Phones (Outgoing)','Practice outgoing phone calls. See team notes for script and procedures.','task',null,null,3]);
await ins([39,'CLA Scanning — Continue Working on Thermal, HRV, sEMG','Continue developing proficiency with all three CLA scan types: thermal, HRV, and sEMG.','task',null,null,4]);
await ins([39,'Re-assessment Re-Eval + X-Ray','Shadow and assist with re-assessment re-evaluation and X-ray appointments.','task',null,null,5]);
await ins([39,'Practice Day 1 Education','Practice delivering Day 1 education to team members.','task',null,null,6]);
await ins([39,'Practice Alerts','Practice navigating and responding to alerts in the system.','task',null,null,7]);

console.log('CA Week 5 Test Out:');
await ins([40,'Take Cashpractice Payments / Demo','Demonstrate ability to process payments in Cashpractice.','task',null,null,1]);
await ins([40,'Confirmation Call Verbiage','Demonstrate correct confirmation call verbiage.','task',null,null,2]);
await ins([40,'VA Tracker Efficiency (In-Office Portion)','Demonstrate efficiency with the in-office portion of VA trackers.','task',null,null,3]);

// 3. CA Week 6 missing items (30003-30009 already inserted, add EOS and 1st Adj)
console.log('CA Week 6 missing:');
await ins([41,'Finish What the Heck is EOS','Complete reading "What the Heck is EOS" — must be finished by end of training.','task',null,null,1]);
await ins([41,'1st Adjustment Verbiage & Day 2 VA Tracker','Learn and practice 1st adjustment verbiage and the Day 2 VA Tracker workflow.','task',null,null,2]);

// 4. CA Week 6 Test Out (ms=42)
console.log('CA Week 6 Test Out:');
await ins([42,'Office Tour','Deliver a complete office tour independently.','task',null,null,1]);
await ins([42,'Day 2 Verbiage, Care Plan Acceptance, Folder Buildout','Demonstrate Day 2 verbiage, guide care plan acceptance, and build out the folder correctly.','task',null,null,2]);
await ins([42,'Explain Difference in Care Plans and Billing','Explain the differences between all care plan types and how billing works for each.','task',null,null,3]);
await ins([42,'Explain How Our Office Differs from Others (Gonstead)','Articulate what makes Reformation Chiropractic unique as a Gonstead nervous system-focused practice.','task',null,null,4]);

// 5. CA Week 7 Test Out missing items (ms=44) — 30019,30020 already inserted by previous run? Check
const [w7toCheck] = await conn.query('SELECT id, title FROM modules WHERE milestoneId=44 ORDER BY id');
console.log('\nCA W7TO current:');
for (const m of w7toCheck) console.log(`  id=${m.id} ${m.title}`);
// Only add if not already there
const w7toTitles = w7toCheck.map(m => m.title);
if (!w7toTitles.some(t => t.includes('Re-Eval'))) {
  await ins([44,'Independent Re-Eval + X-Rays','Perform a re-evaluation and X-ray appointment independently.','task',null,null,4]);
}
if (!w7toTitles.some(t => t.includes('Sign-On'))) {
  await ins([44,'Day 2 Sign-On','Demonstrate the complete Day 2 sign-on process independently.','task',null,null,5]);
}

// 6. Scan Tech Week 5 (ms=60,61)
console.log('\nScan Tech Week 5:');
await ins([60,'CA Onboarding Program Team Members Video 2 (AMPED Video)','Log in to Circle via LastPass and watch CA Onboarding Team Members Video 2.','video',null,null,1]);
await ins([60,'Cashpractice','Practice using Cashpractice for payment processing. See team notes for specific tasks.','task',null,null,2]);
await ins([60,'Phones (Outgoing)','Practice outgoing phone calls. See team notes for script and procedures.','task',null,null,3]);
await ins([60,'CLA Scanning — Continue Working on Thermal, HRV, sEMG','Continue developing proficiency with all three CLA scan types: thermal, HRV, and sEMG.','task',null,null,4]);
await ins([60,'Re-assessment Re-Eval + X-Ray','Shadow and assist with re-assessment re-evaluation and X-ray appointments.','task',null,null,5]);
await ins([60,'Practice Day 1 Education','Practice delivering Day 1 education to team members.','task',null,null,6]);
await ins([60,'Practice Alerts','Practice navigating and responding to alerts in the system.','task',null,null,7]);

console.log('Scan Tech Week 5 Test Out:');
await ins([61,'Take Cashpractice Payments / Demo','Demonstrate ability to process payments in Cashpractice.','task',null,null,1]);
await ins([61,'Confirmation Call Verbiage','Demonstrate correct confirmation call verbiage.','task',null,null,2]);
await ins([61,'VA Tracker Efficiency (In-Office Portion)','Demonstrate efficiency with the in-office portion of VA trackers.','task',null,null,3]);

// 7. Scan Tech Week 6 — check what's already there from previous run
const [stW6existing] = await conn.query('SELECT id, title FROM modules WHERE milestoneId IN (62,63) ORDER BY id');
console.log('\nScan Tech W6 existing:');
for (const m of stW6existing) console.log(`  id=${m.id} ms=62/63 ${m.title}`);

const stW6titles = stW6existing.map(m => m.title);
if (!stW6titles.some(t => t.includes('EOS'))) {
  await ins([62,'Finish What the Heck is EOS','Complete reading "What the Heck is EOS" — must be finished by end of training.','task',null,null,1]);
}
if (!stW6titles.some(t => t.includes('1st Adjustment Verbiage'))) {
  await ins([62,'1st Adjustment Verbiage & Day 2 VA Tracker','Learn and practice 1st adjustment verbiage and the Day 2 VA Tracker workflow.','task',null,null,2]);
}
if (!stW6titles.some(t => t.includes('Care Plans') && t.includes('"'))) {
  await conn.query(
    'INSERT INTO modules (milestoneId, title, description, type, loomUrl, loomUrl2, sortOrder, isRequired) VALUES (?,?,?,?,?,?,?,1)',
    [62,'Watch "Care Plans"','Watch the Care Plans training videos to understand all care plan types and how to present them.','video','https://www.loom.com/share/d7136c15e872431196a9faa7126b7e9f?sid=274bc881-59cd-464e-b172-a824b19d98e1','https://www.loom.com/share/87aad181e07a4a1da9e08e878e858ed7?sid=23e4b35a-4d0a-4af7-9eb1-401fe80c6282',3]
  );
  console.log('  + [ms62] Watch "Care Plans"');
}
if (!stW6titles.some(t => t.includes('Phones (Incoming)'))) {
  await ins([62,'Phones (Incoming)','Practice handling incoming phone calls. See team notes for script and procedures.','task',null,null,4]);
}
if (!stW6titles.some(t => t.includes('Wellness HR'))) {
  await ins([62,'Prep Wellness HR Reports','Prepare Wellness Health Review reports for practice members.','task',null,null,5]);
}
if (!stW6titles.some(t => t.includes('1st Adjustment Folders'))) {
  await ins([62,'Build 1st Adjustment Folders — Correct Content','Build out 1st adjustment folders with the correct content for each care plan type.','task',null,null,6]);
}
if (!stW6titles.some(t => t.includes('Day One Flow'))) {
  await ins([62,'Practice Day One Flow from Tour to End','Practice the full Day One patient flow from office tour through end of appointment.','task',null,null,7]);
}
if (!stW6titles.some(t => t === 'Practice Day 1 Education')) {
  await ins([62,'Practice Day 1 Education','Practice delivering Day 1 education independently.','task',null,null,8]);
}
if (!stW6titles.some(t => t === 'Practice Alerts' && false)) { // always add for W6
  await ins([62,'Practice Alerts','Practice navigating and responding to alerts in the system.','task',null,null,9]);
}

// W6 Test Out Scan Tech
if (!stW6titles.some(t => t === 'Office Tour')) {
  await ins([63,'Office Tour','Deliver a complete office tour independently.','task',null,null,1]);
}
if (!stW6titles.some(t => t.includes('Day 2 Verbiage'))) {
  await ins([63,'Day 2 Verbiage, Care Plan Acceptance, Folder Buildout','Demonstrate Day 2 verbiage, guide care plan acceptance, and build out the folder correctly.','task',null,null,2]);
}
if (!stW6titles.some(t => t.includes('Explain Difference in Care Plans'))) {
  await ins([63,'Explain Difference in Care Plans and Billing','Explain the differences between all care plan types and how billing works for each.','task',null,null,3]);
}
if (!stW6titles.some(t => t.includes('Gonstead'))) {
  await ins([63,'Explain How Our Office Differs from Others (Gonstead)','Articulate what makes Reformation Chiropractic unique as a Gonstead nervous system-focused practice.','task',null,null,4]);
}

// 8. Scan Tech Week 7 — check existing
const [stW7existing] = await conn.query('SELECT id, title FROM modules WHERE milestoneId IN (64,65) ORDER BY id');
console.log('\nScan Tech W7 existing:');
for (const m of stW7existing) console.log(`  id=${m.id} ${m.title}`);

const stW7titles = stW7existing.map(m => m.title);
if (!stW7titles.some(t => t.includes('Chiropractic First'))) {
  await ins([64,'Start Chiropractic First','Begin reading "Chiropractic First" — must be completed by end of training.','task',null,null,1]);
}
if (!stW7titles.some(t => t.includes('Special Appointments'))) {
  await ins([64,'Work on All Special Appointments — Perform and Document','Practice performing and documenting all special appointment types (N, V, F, 2, B).','task',null,null,2]);
}
if (!stW7titles.some(t => t.includes('Objections') && t.includes('"'))) {
  await conn.query(
    'INSERT INTO modules (milestoneId, title, description, type, loomUrl, loomUrl2, sortOrder, isRequired) VALUES (?,?,?,?,?,?,?,1)',
    [64,'Watch "Objections"','Watch the Objections training video to learn how to handle common patient objections.','video','https://www.loom.com/share/4f584f65494a4d298848c9dc78f32d98?sid=6668ff9f-6e38-4cac-beac-9a8e688696e6',null,3]
  );
  console.log('  + [ms64] Watch "Objections"');
}
if (!stW7titles.some(t => t.includes('Video 3'))) {
  await ins([64,'CA Onboarding Program Team Members Video 3','Log in to Circle via LastPass and watch CA Onboarding Team Members Video 3.','video',null,null,4]);
}
if (!stW7titles.some(t => t === 'Practice Day 1 Education')) {
  await ins([64,'Practice Day 1 Education','Practice delivering Day 1 education independently.','task',null,null,5]);
}
if (!stW7titles.some(t => t.includes('AMPED Day 1 Education'))) {
  await ins([64,'AMPED Day 1 Education (25 mins)','Log in to Circle via LastPass → AMPED team modules → AMPED systems and procedures → lesson 3 out of 55 (updated videos 1 and 2).','task',null,null,6]);
}
if (!stW7titles.some(t => t.includes('Practice Office Tour'))) {
  await ins([64,'Practice Office Tour','Practice delivering the office tour independently until proficient.','task',null,null,7]);
}
if (!stW7titles.some(t => t.includes('AMPED Office Tours'))) {
  await ins([64,'Watch AMPED Office Tours','Log in to Circle via LastPass → AMPED team modules → office tours lesson 2 out of 55 → 2 updated training videos.','task',null,null,8]);
}
if (!stW7titles.some(t => t === 'Practice Alerts')) {
  await ins([64,'Practice Alerts','Practice navigating and responding to alerts in the system.','task',null,null,9]);
}
if (!stW7titles.some(t => t.includes('Independent Re-Evals'))) {
  await ins([64,'Independent Re-Evals + X-Ray Appointments','Perform re-evaluation appointments independently: explain scan results, address the 4 scenarios (worse/same/different/better), address objections, explain healing path.','task',null,null,10]);
}
if (!stW7titles.some(t => t.includes('Day 2 Greeting'))) {
  await ins([64,'Memorize Day 2 Greeting and Care Plan Setup','Memorize the Day 2 greeting script and care plan setup process.','task',null,null,11]);
}

// W7 Test Out Scan Tech (ms=65)
if (!stW7titles.some(t => t.includes('Day 1 Education — Full'))) {
  await ins([65,'Day 1 Education — Full Delivery','Deliver complete Day 1 education independently.','task',null,null,1]);
}
if (!stW7titles.some(t => t.includes('NPM Appointment'))) {
  await ins([65,'NPM Appointment — Start to Finish','Perform a full New Patient appointment from start to finish independently.','task',null,null,2]);
}
if (!stW7titles.some(t => t.includes('Objection Responses'))) {
  await ins([65,'Objection Responses','Demonstrate responses to common patient objections.','task',null,null,3]);
}
if (!stW7titles.some(t => t.includes('Re-Eval + X-Rays'))) {
  await ins([65,'Independent Re-Eval + X-Rays','Perform a re-evaluation and X-ray appointment independently.','task',null,null,4]);
}
if (!stW7titles.some(t => t.includes('Sign-On'))) {
  await ins([65,'Day 2 Sign-On','Demonstrate the complete Day 2 sign-on process independently.','task',null,null,5]);
}

console.log('\n✅ All done!');
await conn.end();
