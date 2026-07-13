import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config();

const sopContent = JSON.parse(readFileSync("/home/ubuntu/sop_content.json", "utf-8"));

// Create a raw mysql2 connection for seeding
const connection = await mysql.createConnection(process.env.DATABASE_URL);

async function q(sql, params = []) {
  const [rows] = await connection.execute(sql, params);
  return rows;
}

// ─── Categories ───────────────────────────────────────────────────────────────
const categories = [
  { name: "Company Overview", slug: "company-overview", description: "Core values, mission, and company fundamentals", sortOrder: 1 },
  { name: "Admin Procedures", slug: "admin-procedures", description: "Day-to-day administrative workflows and protocols", sortOrder: 2 },
  { name: "Care Plans", slug: "care-plans", description: "Care plan guidelines, billing, and patient management", sortOrder: 3 },
  { name: "Scripts", slug: "scripts", description: "Phone scripts, patient education, and communication guides", sortOrder: 4 },
  { name: "Special Appointment Processes", slug: "special-appointments", description: "NPM, infant, PI, re-evaluation, and specialized visit protocols", sortOrder: 5 },
  { name: "Events", slug: "events", description: "Workshop and community event SOPs", sortOrder: 6 },
  { name: "Pregnancy SOPs", slug: "pregnancy", description: "Pregnancy, postpartum, and prenatal care protocols", sortOrder: 7 },
];

// ─── SOPs mapped to categories ────────────────────────────────────────────────
const sopMap = [
  { title: "Employee Onboarding SOP", categorySlug: "company-overview", googleDocId: "1I1cF-MLjzNdTZvvzB1tiQ8650xX9LJw7VW0S1Etf6ZY", contentKey: "Employee Onboarding SOP" },
  { title: "Core Values", categorySlug: "company-overview", googleDocId: "1UFhHccLSC1pWTVhUbjXPmZ5jSCYoRQC9b25sMjb2dXU", contentKey: "Core Values" },
  { title: "Office Reimbursements", categorySlug: "company-overview", googleDocId: "1qEtStrinhc4W3W0wbNbw2Pox3qCI-o8SOiZu4V3r-80", contentKey: "Office Reimbursements" },
  { title: "Step Up Process", categorySlug: "company-overview", googleDocId: "1QW-BeOLfKCuDYDXggS0VOFRBHwuXRCD1fxqIYE6BD5A", contentKey: "Step Up Process" },
  { title: "Medicare Guidelines (Age 65+)", categorySlug: "admin-procedures", googleDocId: "1QZmAhDUMlEgX2To39Ru1nXgbOv5ypLQBA5b1tEoRQyw", contentKey: "MEDICARE GUIDELINES" },
  { title: "Appointment Types", categorySlug: "admin-procedures", googleDocId: "185M8VF6Q4IiY7clfFbg_9vKvwM53WCUgEhqDLwt-pT4", contentKey: "Appointment Types" },
  { title: "Declined Payment", categorySlug: "admin-procedures", googleDocId: "1o-5OcvuLYxbgPxk6aRRCZH9yQtdH0qEkPk8Jnebnywc", contentKey: "Declined Payment" },
  { title: "4-Month Care Discontinuation", categorySlug: "admin-procedures", googleDocId: "1KyMZWop3r2GPpgZdOMoFIVJkNOeIJKxivIXX5xLqe6E", contentKey: "4 Month Care Discontinuation" },
  { title: "Alert Guide", categorySlug: "admin-procedures", googleDocId: "1g84ATxX7kXl-USZR1_fYoBjYlacMa3GmYyNu3X-3h7g", contentKey: "Alert Guide" },
  { title: "Records Requests & Subpoena", categorySlug: "admin-procedures", googleDocId: "1XE-p5vy7x47z_FzzDVfyAaiXwWJpWqytpqgJEboLg5c", contentKey: "Records Requests" },
  { title: "IntakeQ Re-Eval Paperwork", categorySlug: "admin-procedures", googleDocId: "1fC0J5nV2Ne2r9BliqYSxtXXid2vbaNi1dpr6GzO8_kc", contentKey: "IntakeQ Re Eval Paperwork" },
  { title: "Office Closures", categorySlug: "admin-procedures", googleDocId: "153XpNnf-76EFwHQq6OUFdLH3F6hbgPXwz8eIrkWDAM4", contentKey: "Office Closures" },
  { title: "No Internet / Power Outage", categorySlug: "admin-procedures", googleDocId: "17Wfz1Qf9hIwuT1rX2y8ZFVl2xGGpgGJ4QklqVCUHabQ", contentKey: "No Internet Power" },
  { title: "Wellness Billing Guidelines", categorySlug: "care-plans", googleDocId: "13IExfoOlxXlUtzcTY_PTSvX4hL1co28Lk1-I_8m7_9A", contentKey: "Wellness Billing Guidelines" },
  { title: "Converting Monthly Plan to PIF", categorySlug: "care-plans", googleDocId: "18qgcL729INDLOqEAuyWQS0qKT3pTc_jzGrZ0WzdQigI", contentKey: "Converting Monthly to PIF" },
  { title: "Care Plan Cheat Sheet", categorySlug: "care-plans", googleDocId: "1-4xs21x4KUbFZXQcV-mKtK5W36l5m3XJIe4ub7AErgM", contentKey: "Care Plan Cheat Sheet" },
  { title: "Care Plan Deferral", categorySlug: "care-plans", googleDocId: "1xDkfa5qD6BRIzdZRV0sXMSlRczNuqJJNaSKJO7GMXFY", contentKey: "Care Plan Deferral" },
  { title: "Care Plan Refusal", categorySlug: "care-plans", googleDocId: "1IVDWxlNsIq-e1R27C82n2lsIoAmOPXp_fRxUHfUI4ZU", contentKey: "CP Refusal" },
  { title: "FWP 3.0 – Annual Price Increase", categorySlug: "care-plans", googleDocId: "1v-zzAR0WGkCNxa1zlgYHOdZt7D53V3MLgZQxtTsisqw", contentKey: "FWP 3.0 Annual Price Increase" },
  { title: "Phone Script", categorySlug: "scripts", googleDocId: "1p1yeb3bf4qXNdoN5APhQ8p8rBYj-NcJVcx6IE_Rc7ss", contentKey: "Phone Script" },
  { title: "Objections Scripts", categorySlug: "scripts", googleDocId: "1LCvnri6TT7LgLYe7PNSytt1NZR_-Um6WP2x-q7I4shw", contentKey: "Objections Scripts" },
  { title: "Day 1 CLA Script", categorySlug: "scripts", googleDocId: "1NeycjXo197-LPkWZjc2O46JB7KNX8s3rcXDwJzD9UqY", contentKey: "Day 1 CLA Script" },
  { title: "Discontinuation Call Script & SOP", categorySlug: "scripts", googleDocId: "1zt2uX8QHh5KTYn5lGCOwNp9BJLcKHboQhY4c-2t5GEo", contentKey: "Discontinuation Call Script" },
  { title: "Day 2 Script", categorySlug: "scripts", googleDocId: "1pZb3atFcaqW1DSKMEetPHX2iKN7UGAbBObhAehFN-S4", contentKey: "Day 2 Script" },
  { title: "Office Tour Script", categorySlug: "scripts", googleDocId: "1wGO5f58_HgJ-f9czLfKA_Wg2tepkuJH9-jgdEDlKW3Y", contentKey: "Office Tour" },
  { title: "Intermediate Application of Care", categorySlug: "special-appointments", googleDocId: "12gD7lY4_pzrGXKQLxGCtn8nitHFuCjSTW1-eiqNdApo", contentKey: "Intermediate Application of Care" },
  { title: "PI (Personal Injury) SOP", categorySlug: "special-appointments", googleDocId: "1xVxfJoPqI4lw-r3yS1BhMeqR1naBFRJVR_CHszIxaxc", contentKey: "PI Updated" },
  { title: "ND Re-Evaluation", categorySlug: "special-appointments", googleDocId: "1IklapXcfnEeMuonhdZRARudnKmYACTyS_MqznO6IiHc", contentKey: "ND Re-Evaluation" },
  { title: "Phone Consult & NPM Appointment Prep", categorySlug: "special-appointments", googleDocId: "1mXh6_M7xLXHX0Au0cTAcGZH_5WiO1WGXAYZPdEKm-YM", contentKey: "Phone Consult NPM Prep" },
  { title: "Infant Day 1", categorySlug: "special-appointments", googleDocId: "1T4KT8ScGh8_dkjIsDXBtG_6S-jjzuBAV46kkRZecEJs", contentKey: "Infant Day 1" },
  { title: "Re-Evaluation Process", categorySlug: "special-appointments", googleDocId: "1k0uBBJqSYg20RQtCscgi6cP9EYwNPYkH5tDSiR3ge08", contentKey: "Re-Eval Process" },
  { title: "Dinner With the Doc SOP", categorySlug: "events", googleDocId: "1lX4vKLl-mVXKWcUWdMMoKqjwBrMW3IRxIN2Ye1jxo58", contentKey: "Dinner With the Doc SOP" },
  { title: "Workshop SOP", categorySlug: "events", googleDocId: "17LLafbqujsGwrOp2BxHVHjeXVgCzb_WfKp_1PFGVlnI", contentKey: "Workshop SOP" },
  { title: "Postpartum SOP", categorySlug: "pregnancy", googleDocId: "183DBxT8kCciZOpoTWfllmljrQOLIA2ct8UtdOCyxnhU", contentKey: "Postpartum" },
  { title: "Current PM: Pregnancy Care Plan", categorySlug: "pregnancy", googleDocId: "1RF2CrIxaCRzGjbWf_SMg71yYJhhvR0PuACBjUywSJ-w", contentKey: "Current PM PCP" },
  { title: "New PM Pregnancy CP SOP", categorySlug: "pregnancy", googleDocId: "1nrBPAq4NBovEQTfYB1bHHhOxlb9HeQ0M7b4VrQKpR-0", contentKey: "New PM Pregnancy CP SOP" },
];

// ─── Track definitions ────────────────────────────────────────────────────────
const allTracks = [
  {
    teamRole: "ca", name: "Chiropractic Assistant (CA)",
    description: "Complete onboarding track for Chiropractic Assistants at Reformation Chiropractic",
    milestones: [
      { title: "Week 1 — Foundation", weekNumber: 1, description: "Company culture, core values, systems orientation, and initial patient flow observation", modules: [
        { title: "Core Values & Culture", type: "sop", contentKey: "Core Values", description: "Understand the mission, vision, and core values of Reformation Chiropractic" },
        { title: "Office Tour & Orientation", type: "sop", contentKey: "Office Tour", description: "Learn the physical layout, equipment locations, and daily flow of the office" },
        { title: "Appointment Types Overview", type: "sop", contentKey: "Appointment Types", description: "Understand every appointment type and what happens during each" },
        { title: "Alert Guide", type: "sop", contentKey: "Alert Guide", description: "Learn all office alerts and how to respond to each one" },
        { title: "Phone Script", type: "sop", contentKey: "Phone Script", description: "Master the phone script for new patient inquiries and scheduling" },
        { title: "Employee Onboarding Overview", type: "sop", contentKey: "Employee Onboarding SOP", description: "Review the full onboarding process and what to expect in your first 90 days" },
      ]},
      { title: "Week 2 — Clinical Workflow", weekNumber: 2, description: "Patient management, care plans, scripts, and ChiroHD system training", modules: [
        { title: "Care Plan Cheat Sheet", type: "sop", contentKey: "Care Plan Cheat Sheet", description: "Quick reference for all care plan types and pricing" },
        { title: "Care Plan Deferral SOP", type: "sop", contentKey: "Care Plan Deferral", description: "How to handle patients who want to defer starting their care plan" },
        { title: "Care Plan Refusal SOP", type: "sop", contentKey: "CP Refusal", description: "How to handle patients who refuse a care plan" },
        { title: "Day 1 CLA Script", type: "sop", contentKey: "Day 1 CLA Script", description: "Master the Day 1 patient education script" },
        { title: "Day 2 Script", type: "sop", contentKey: "Day 2 Script", description: "Master the Day 2 report of findings script" },
        { title: "Objections Scripts", type: "sop", contentKey: "Objections Scripts", description: "How to handle common patient objections with confidence" },
        { title: "Phone Consult & NPM Prep", type: "sop", contentKey: "Phone Consult NPM Prep", description: "How to prepare for phone consults and new patient appointments" },
        { title: "Declined Payment SOP", type: "sop", contentKey: "Declined Payment", description: "How to handle declined payments professionally" },
      ]},
      { title: "Week 30 — Advanced Procedures", weekNumber: 30, description: "Specialized appointment processes, billing, and advanced patient scenarios", modules: [
        { title: "Wellness Billing Guidelines", type: "sop", contentKey: "Wellness Billing Guidelines", description: "Wellness billing codes, rules, and documentation requirements" },
        { title: "Converting Monthly Plan to PIF", type: "sop", contentKey: "Converting Monthly to PIF", description: "How to guide patients from monthly plans to paid-in-full" },
        { title: "FWP 3.0 Annual Price Increase", type: "sop", contentKey: "FWP 3.0 Annual Price Increase", description: "How to communicate and process the annual price increase" },
        { title: "Records Requests & Subpoena", type: "sop", contentKey: "Records Requests", description: "How to handle records requests and legal subpoenas" },
        { title: "IntakeQ Re-Eval Paperwork", type: "sop", contentKey: "IntakeQ Re Eval Paperwork", description: "How to process re-evaluation paperwork in IntakeQ" },
        { title: "4-Month Care Discontinuation", type: "sop", contentKey: "4 Month Care Discontinuation", description: "Protocol for patients who have not proceeded with care after 4 months" },
        { title: "Discontinuation Call Script", type: "sop", contentKey: "Discontinuation Call Script", description: "How to conduct discontinuation calls with empathy and professionalism" },
        { title: "ND Re-Evaluation SOP", type: "sop", contentKey: "ND Re-Evaluation", description: "Protocol for neurodivergent patient re-evaluations" },
        { title: "Re-Evaluation Process", type: "sop", contentKey: "Re-Eval Process", description: "Full re-evaluation workflow from scheduling to completion" },
        { title: "Infant Day 1 SOP", type: "sop", contentKey: "Infant Day 1", description: "Special protocol for infant new patient appointments" },
      ]},
      { title: "Week 90 — Mastery & Specialty", weekNumber: 90, description: "Specialty protocols, events, pregnancy care, and full operational mastery", modules: [
        { title: "Intermediate Application of Care", type: "sop", contentKey: "Intermediate Application of Care", description: "Advanced care application protocols for complex patient scenarios" },
        { title: "PI (Personal Injury) SOP", type: "sop", contentKey: "PI Updated", description: "Complete personal injury case management protocol" },
        { title: "Medicare Guidelines (Age 65+)", type: "sop", contentKey: "MEDICARE GUIDELINES", description: "Medicare compliance, billing rules, and documentation for patients 65+" },
        { title: "Office Closures SOP", type: "sop", contentKey: "Office Closures", description: "How to handle planned and emergency office closures" },
        { title: "No Internet / Power Outage", type: "sop", contentKey: "No Internet Power", description: "Emergency protocols for technology and power failures" },
        { title: "Dinner With the Doc SOP", type: "sop", contentKey: "Dinner With the Doc SOP", description: "How to plan and execute Dinner With the Doc community events" },
        { title: "Workshop SOP", type: "sop", contentKey: "Workshop SOP", description: "How to plan and execute patient education workshops" },
        { title: "Pregnancy Care Plan SOP", type: "sop", contentKey: "New PM Pregnancy CP SOP", description: "New patient pregnancy care plan protocols" },
        { title: "Postpartum SOP", type: "sop", contentKey: "Postpartum", description: "Postpartum patient transition protocols" },
        { title: "Step Up Process", type: "sop", contentKey: "Step Up Process", description: "Career advancement and step-up process at Reformation" },
        { title: "Office Reimbursements", type: "sop", contentKey: "Office Reimbursements", description: "How to submit and process office reimbursements" },
      ]},
    ]
  },
  {
    teamRole: "associate_doctor", name: "Associate Doctor",
    description: "Onboarding track for Associate Doctors at Reformation Chiropractic",
    milestones: [
      { title: "Week 1 — Practice Philosophy", weekNumber: 1, description: "Gonstead philosophy, nervous system focus, and Reformation's clinical approach", modules: [
        { title: "Core Values & Mission", type: "sop", contentKey: "Core Values", description: "Mission, vision, and core values" },
        { title: "Employee Onboarding Overview", type: "sop", contentKey: "Employee Onboarding SOP", description: "Full onboarding process and expectations" },
        { title: "Appointment Types Overview", type: "sop", contentKey: "Appointment Types", description: "Every appointment type and clinical workflow" },
        { title: "Day 1 CLA Script", type: "sop", contentKey: "Day 1 CLA Script", description: "Day 1 patient education script" },
        { title: "Day 2 Script", type: "sop", contentKey: "Day 2 Script", description: "Day 2 report of findings script" },
      ]},
      { title: "Week 2 — Clinical Protocols", weekNumber: 2, description: "Specialized appointment types, re-evaluations, and patient scenarios", modules: [
        { title: "ND Re-Evaluation SOP", type: "sop", contentKey: "ND Re-Evaluation", description: "Neurodivergent re-evaluation protocols" },
        { title: "Re-Evaluation Process", type: "sop", contentKey: "Re-Eval Process", description: "Full re-evaluation workflow" },
        { title: "Infant Day 1 SOP", type: "sop", contentKey: "Infant Day 1", description: "Infant new patient appointment protocol" },
        { title: "Intermediate Application of Care", type: "sop", contentKey: "Intermediate Application of Care", description: "Advanced care application protocols" },
        { title: "Phone Consult & NPM Prep", type: "sop", contentKey: "Phone Consult NPM Prep", description: "Phone consult and new patient prep protocols" },
      ]},
      { title: "Week 30 — Care Plans & Business", weekNumber: 30, description: "Care plan structure, billing, and business operations", modules: [
        { title: "Care Plan Cheat Sheet", type: "sop", contentKey: "Care Plan Cheat Sheet", description: "All care plan types and pricing" },
        { title: "Wellness Billing Guidelines", type: "sop", contentKey: "Wellness Billing Guidelines", description: "Wellness billing codes and documentation" },
        { title: "Medicare Guidelines (Age 65+)", type: "sop", contentKey: "MEDICARE GUIDELINES", description: "Medicare compliance and billing rules" },
        { title: "PI (Personal Injury) SOP", type: "sop", contentKey: "PI Updated", description: "Personal injury case management" },
        { title: "Pregnancy Care Plan SOP", type: "sop", contentKey: "New PM Pregnancy CP SOP", description: "Pregnancy care plan protocols" },
        { title: "Postpartum SOP", type: "sop", contentKey: "Postpartum", description: "Postpartum patient transition" },
      ]},
      { title: "Week 90 — Full Integration", weekNumber: 90, description: "Events, specialty protocols, and full practice mastery", modules: [
        { title: "Objections Scripts", type: "sop", contentKey: "Objections Scripts", description: "Handling patient objections" },
        { title: "Dinner With the Doc SOP", type: "sop", contentKey: "Dinner With the Doc SOP", description: "Community event protocol" },
        { title: "Workshop SOP", type: "sop", contentKey: "Workshop SOP", description: "Patient education workshop protocol" },
        { title: "Step Up Process", type: "sop", contentKey: "Step Up Process", description: "Career advancement at Reformation" },
      ]},
    ]
  },
  {
    teamRole: "scan_tech", name: "Scan Tech",
    description: "Onboarding track for Scan Technicians at Reformation Chiropractic",
    milestones: [
      { title: "Week 1 — Orientation", weekNumber: 1, description: "Company culture, office layout, and scan technology fundamentals", modules: [
        { title: "Core Values & Culture", type: "sop", contentKey: "Core Values", description: "Mission, vision, and core values" },
        { title: "Office Tour & Orientation", type: "sop", contentKey: "Office Tour", description: "Physical layout and daily flow" },
        { title: "Appointment Types Overview", type: "sop", contentKey: "Appointment Types", description: "Every appointment type and what happens during each" },
        { title: "Alert Guide", type: "sop", contentKey: "Alert Guide", description: "Office alerts and responses" },
      ]},
      { title: "Week 2 — Scan Protocols", weekNumber: 2, description: "Scan procedures, patient prep, and documentation", modules: [
        { title: "Phone Consult & NPM Prep", type: "sop", contentKey: "Phone Consult NPM Prep", description: "New patient appointment preparation" },
        { title: "ND Re-Evaluation SOP", type: "sop", contentKey: "ND Re-Evaluation", description: "Neurodivergent re-evaluation protocols" },
        { title: "Re-Evaluation Process", type: "sop", contentKey: "Re-Eval Process", description: "Full re-evaluation workflow" },
        { title: "Infant Day 1 SOP", type: "sop", contentKey: "Infant Day 1", description: "Infant new patient protocol" },
      ]},
      { title: "Week 30 — Advanced Scanning", weekNumber: 30, description: "Complex scan scenarios and specialty populations", modules: [
        { title: "Intermediate Application of Care", type: "sop", contentKey: "Intermediate Application of Care", description: "Advanced care application protocols" },
        { title: "Pregnancy Care Plan SOP", type: "sop", contentKey: "New PM Pregnancy CP SOP", description: "Pregnancy patient protocols" },
        { title: "Postpartum SOP", type: "sop", contentKey: "Postpartum", description: "Postpartum patient protocols" },
        { title: "IntakeQ Re-Eval Paperwork", type: "sop", contentKey: "IntakeQ Re Eval Paperwork", description: "Re-evaluation paperwork processing" },
      ]},
      { title: "Week 90 — Mastery", weekNumber: 90, description: "Full operational mastery and specialty protocols", modules: [
        { title: "Step Up Process", type: "sop", contentKey: "Step Up Process", description: "Career advancement at Reformation" },
        { title: "Dinner With the Doc SOP", type: "sop", contentKey: "Dinner With the Doc SOP", description: "Community event support" },
        { title: "Workshop SOP", type: "sop", contentKey: "Workshop SOP", description: "Workshop support protocols" },
      ]},
    ]
  },
  {
    teamRole: "preceptor", name: "Preceptor",
    description: "Onboarding track for Preceptors at Reformation Chiropractic",
    milestones: [
      { title: "Week 1 — Foundation", weekNumber: 1, description: "Reformation philosophy, teaching methodology, and student orientation", modules: [
        { title: "Core Values & Culture", type: "sop", contentKey: "Core Values", description: "Mission, vision, and core values" },
        { title: "Employee Onboarding Overview", type: "sop", contentKey: "Employee Onboarding SOP", description: "Full onboarding process and expectations" },
        { title: "Appointment Types Overview", type: "sop", contentKey: "Appointment Types", description: "Every appointment type and clinical workflow" },
        { title: "Office Tour & Orientation", type: "sop", contentKey: "Office Tour", description: "Physical layout and daily flow" },
      ]},
      { title: "Week 2 — Clinical Teaching", weekNumber: 2, description: "Clinical supervision protocols and student evaluation", modules: [
        { title: "Day 1 CLA Script", type: "sop", contentKey: "Day 1 CLA Script", description: "Day 1 patient education script" },
        { title: "Day 2 Script", type: "sop", contentKey: "Day 2 Script", description: "Day 2 report of findings script" },
        { title: "ND Re-Evaluation SOP", type: "sop", contentKey: "ND Re-Evaluation", description: "Neurodivergent re-evaluation protocols" },
        { title: "Re-Evaluation Process", type: "sop", contentKey: "Re-Eval Process", description: "Full re-evaluation workflow" },
        { title: "Intermediate Application of Care", type: "sop", contentKey: "Intermediate Application of Care", description: "Advanced care application protocols" },
      ]},
      { title: "Week 30 — Advanced Supervision", weekNumber: 30, description: "Complex case supervision and specialty populations", modules: [
        { title: "Infant Day 1 SOP", type: "sop", contentKey: "Infant Day 1", description: "Infant new patient protocol" },
        { title: "PI (Personal Injury) SOP", type: "sop", contentKey: "PI Updated", description: "Personal injury case management" },
        { title: "Pregnancy Care Plan SOP", type: "sop", contentKey: "New PM Pregnancy CP SOP", description: "Pregnancy care plan protocols" },
        { title: "Postpartum SOP", type: "sop", contentKey: "Postpartum", description: "Postpartum patient protocols" },
        { title: "Medicare Guidelines (Age 65+)", type: "sop", contentKey: "MEDICARE GUIDELINES", description: "Medicare compliance and billing" },
      ]},
      { title: "Week 90 — Mastery & Leadership", weekNumber: 90, description: "Full clinical mastery, events, and leadership development", modules: [
        { title: "Objections Scripts", type: "sop", contentKey: "Objections Scripts", description: "Handling patient objections" },
        { title: "Dinner With the Doc SOP", type: "sop", contentKey: "Dinner With the Doc SOP", description: "Community event protocol" },
        { title: "Workshop SOP", type: "sop", contentKey: "Workshop SOP", description: "Workshop protocol" },
        { title: "Step Up Process", type: "sop", contentKey: "Step Up Process", description: "Career advancement at Reformation" },
      ]},
    ]
  },
];

async function seed() {
  console.log("Seeding database...");

  // 1. Insert categories
  const categoryIdMap = {};
  for (const cat of categories) {
    await q(
      `INSERT INTO sop_categories (name, slug, description, sortOrder, createdAt) 
       VALUES (?, ?, ?, ?, NOW()) 
       ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description)`,
      [cat.name, cat.slug, cat.description, cat.sortOrder]
    );
    const rows = await q(`SELECT id FROM sop_categories WHERE slug = ?`, [cat.slug]);
    categoryIdMap[cat.slug] = rows[0].id;
    console.log(`  Category: ${cat.name} (id=${categoryIdMap[cat.slug]})`);
  }

  // 2. Insert SOPs
  const sopIdMap = {};
  for (const sop of sopMap) {
    const catId = categoryIdMap[sop.categorySlug];
    if (!catId) { console.warn(`  No category for ${sop.title}`); continue; }
    const content = sopContent[sop.contentKey] || `Content for ${sop.title} — to be updated from Google Drive.`;
    await q(
      `INSERT INTO sops (categoryId, title, content, googleDocId, lastUpdated, version, isActive, flaggedForReview, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, NOW(), 1, 1, 0, NOW(), NOW())
       ON DUPLICATE KEY UPDATE title=VALUES(title), content=VALUES(content), updatedAt=NOW()`,
      [catId, sop.title, content, sop.googleDocId]
    );
    const rows = await q(`SELECT id FROM sops WHERE googleDocId = ?`, [sop.googleDocId]);
    sopIdMap[sop.contentKey] = rows[0]?.id;
    console.log(`  SOP: ${sop.title}`);
  }

  // 3. Insert tracks, milestones, modules
  for (const track of allTracks) {
    await q(
      `INSERT INTO tracks (teamRole, name, description, createdAt) VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description)`,
      [track.teamRole, track.name, track.description]
    );
    const trackRows = await q(`SELECT id FROM tracks WHERE teamRole = ?`, [track.teamRole]);
    const trackId = trackRows[0].id;
    console.log(`  Track: ${track.name} (id=${trackId})`);

    for (let mi = 0; mi < track.milestones.length; mi++) {
      const ms = track.milestones[mi];
      // Delete existing milestone for this track+week to allow re-seed
      const existingMs = await q(`SELECT id FROM milestones WHERE trackId = ? AND weekNumber = ?`, [trackId, ms.weekNumber]);
      let milestoneId;
      if (existingMs.length > 0) {
        milestoneId = existingMs[0].id;
        await q(`UPDATE milestones SET title=?, description=?, sortOrder=? WHERE id=?`, [ms.title, ms.description, mi, milestoneId]);
      } else {
        await q(
          `INSERT INTO milestones (trackId, title, description, weekNumber, sortOrder, createdAt) VALUES (?, ?, ?, ?, ?, NOW())`,
          [trackId, ms.title, ms.description, ms.weekNumber, mi]
        );
        const msRows = await q(`SELECT id FROM milestones WHERE trackId = ? AND weekNumber = ?`, [trackId, ms.weekNumber]);
        milestoneId = msRows[0].id;
      }

      for (let modi = 0; modi < ms.modules.length; modi++) {
        const mod = ms.modules[modi];
        const sopId = sopIdMap[mod.contentKey] || null;
        // Check if module exists
        const existingMod = await q(`SELECT id FROM modules WHERE milestoneId = ? AND title = ?`, [milestoneId, mod.title]);
        if (existingMod.length > 0) {
          await q(`UPDATE modules SET sopId=?, description=?, sortOrder=? WHERE id=?`, [sopId, mod.description, modi, existingMod[0].id]);
        } else {
          await q(
            `INSERT INTO modules (milestoneId, title, description, type, sopId, sortOrder, isRequired, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
            [milestoneId, mod.title, mod.description, mod.type, sopId, modi]
          );
        }
      }
      console.log(`    Milestone: ${ms.title} (${ms.modules.length} modules)`);
    }
  }

  console.log("\nSeeding complete!");
  await connection.end();
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
