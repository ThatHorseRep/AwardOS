/**
 * One-off: snapshot every public table to JSON.
 *
 * Not a substitute for pg_dump — it captures data, not schema, constraints or
 * sequences. It exists as a safety net before schema-adoption steps on a
 * database that already holds real ballots.
 *
 * Usage: node scripts/backup-data.js <output-dir>
 */
require('dotenv').config({ path: '.env.local' });

const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

const outDir = process.argv[2];

if (!outDir) {
  console.error('Usage: node scripts/backup-data.js <output-dir>');
  process.exit(2);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(2);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

(async () => {
  try {
    fs.mkdirSync(outDir, { recursive: true });

    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `;

    const all = {};
    let total = 0;

    for (const { table_name } of tables) {
      const rows = await sql.unsafe(`SELECT * FROM public."${table_name}"`);
      all[table_name] = rows;
      total += rows.length;
    }

    const file = path.join(outDir, `data-snapshot-${new Date().toISOString().slice(0, 10)}.json`);
    fs.writeFileSync(file, JSON.stringify(all, null, 1));

    console.log(`Wrote ${file}`);
    console.log(`${total} rows across ${tables.length} tables (${fs.statSync(file).size} bytes)`);
  } catch (err) {
    console.error('Backup failed:', err.message);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
})();
