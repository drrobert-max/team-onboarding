import mysql from 'mysql2/promise';
import { execSync } from 'child_process';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const CARE_PLANS_CATEGORY_ID = 3;

const SOPS_TO_SYNC = [
  { googleDocId: '15sQRjXkwogc1A_QWny6z9NculbllHDPSHyXW088M9g8', title: '12WBR SOP' },
  { googleDocId: '1zFbEkxCTJsPaxx_G_TGIAjM-ogQBMvsV7fr0GbE0W68', title: '12WBR EXT Plan 24 weeks' },
  { googleDocId: '1lwiToxCDeLQkbsLVW_s36vZRmuC_9NylCjJdUkZj5Ys', title: '6 Month Behavior Reset' },
  { googleDocId: '13IExfoOlxXlUtzcTY_PTSvX4hL1co28Lk1-I_8m7_9A', title: 'Wellness Billing Guidelines' },
];

for (const sop of SOPS_TO_SYNC) {
  console.log(`\nFetching: ${sop.title}...`);
  let content = '';
  try {
    const raw = execSync(
      `gws docs documents get --params '{"documentId":"${sop.googleDocId}"}' --format json`,
      { encoding: 'utf8' }
    );
    const data = JSON.parse(raw);
    const bodyContent = data?.body?.content || [];
    for (const elem of bodyContent) {
      const para = elem?.paragraph;
      if (!para) continue;
      for (const pe of para.elements || []) {
        content += pe?.textRun?.content || '';
      }
    }
    console.log(`  Extracted ${content.length} chars`);
  } catch (e) {
    console.error(`  Failed to fetch: ${e.message}`);
    continue;
  }

  // Check if already exists
  const [existing] = await conn.query(
    'SELECT id FROM sops WHERE googleDocId = ? LIMIT 1',
    [sop.googleDocId]
  );

  if (existing.length > 0) {
    const id = existing[0].id;
    await conn.query(
      'UPDATE sops SET content = ?, title = ?, lastUpdated = NOW(), version = version + 1 WHERE id = ?',
      [content, sop.title, id]
    );
    console.log(`  Updated existing SOP id=${id}`);
  } else {
    const [result] = await conn.query(
      'INSERT INTO sops (title, content, categoryId, googleDocId, lastUpdated, version, isActive) VALUES (?, ?, ?, ?, NOW(), 1, 1)',
      [sop.title, content, CARE_PLANS_CATEGORY_ID, sop.googleDocId]
    );
    console.log(`  Inserted new SOP id=${result.insertId}`);
  }
}

// Verify
const [allSops] = await conn.query(
  'SELECT id, title, categoryId FROM sops WHERE categoryId = ? ORDER BY id',
  [CARE_PLANS_CATEGORY_ID]
);
console.log('\nCare Plans SOPs in DB:');
for (const s of allSops) console.log(`  id=${s.id} "${s.title}"`);

await conn.end();
console.log('\nDone.');
