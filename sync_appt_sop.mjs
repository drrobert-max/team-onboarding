import mysql from 'mysql2/promise';
import { execSync } from 'child_process';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 1. Fetch latest content from Google Doc
console.log('Fetching latest content from Google Doc...');
const raw = execSync(
  `gws docs documents get --params '{"documentId":"185M8VF6Q4IiY7clfFbg_9vKvwM53WCUgEhqDLwt-pT4"}' --format json`,
  { encoding: 'utf8' }
);
const data = JSON.parse(raw);
const title = data.title || 'Appointment Types';

// Extract plain text
let text = '';
const content = data?.body?.content || [];
for (const elem of content) {
  const para = elem?.paragraph;
  if (!para) continue;
  for (const pe of para.elements || []) {
    text += pe?.textRun?.content || '';
  }
}

console.log(`Extracted ${text.length} chars from "${title}"`);

// 2. Update SOP id=6 with latest content
const [upd] = await conn.query(
  'UPDATE sops SET content=?, lastUpdated=NOW(), version=version+1 WHERE id=6',
  [text]
);
console.log(`Updated SOP id=6, affected=${upd.affectedRows}`);

// 3. Link the two "Memorize Appointment Types" modules in Week 2 to sopId=6
// Module ids 30084 (CA) and 30085 (Scan Tech)
const [lnk] = await conn.query(
  'UPDATE modules SET sopId=6 WHERE id IN (30084, 30085)',
);
console.log(`Linked modules to SOP, affected=${lnk.affectedRows}`);

// 4. Verify
const [mods] = await conn.query(
  'SELECT id, title, sopId, milestoneId FROM modules WHERE id IN (30084, 30085)'
);
console.log('\nVerification:');
for (const m of mods) console.log(`  id=${m.id} ms=${m.milestoneId} sopId=${m.sopId} "${m.title}"`);

await conn.end();
console.log('\nDone.');
