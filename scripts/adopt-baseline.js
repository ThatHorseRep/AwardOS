/**
 * One-off: adopt the current migration baseline on a database that already
 * has every object in it.
 *
 * Context: this project applied migrations with a hand-rolled runner that kept
 * no ledger, so `drizzle.__drizzle_migrations` is empty while all 28 tables
 * exist. Running `drizzle-kit migrate` in that state would try to CREATE
 * everything again and fail. Recording the baseline as already-applied lets
 * drizzle-kit take over as the single migration path from here on.
 *
 * Safe to re-run: it inserts nothing if the baseline is already recorded, and
 * it refuses to run at all if the database looks empty (that database wants a
 * real migration, not an adoption).
 *
 * Usage: node scripts/adopt-baseline.js [--apply]
 * Without --apply it reports what it would do and changes nothing.
 */
require('dotenv').config({ path: '.env.local' });

const postgres = require('postgres');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const APPLY = process.argv.includes('--apply');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(2);
}

const migrationsDir = path.join(__dirname, '../src/lib/db/migrations');
const journal = JSON.parse(fs.readFileSync(path.join(migrationsDir, 'meta/_journal.json'), 'utf8'));

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

(async () => {
  try {
    // Same hash drizzle's migrator computes: sha256 of the raw migration file.
    const entries = journal.entries.map((e) => {
      const file = path.join(migrationsDir, `${e.tag}.sql`);
      const contents = fs.readFileSync(file).toString();
      return {
        tag: e.tag,
        when: e.when,
        hash: crypto.createHash('sha256').update(contents).digest('hex'),
      };
    });

    const [{ n: tableCount }] = await sql`
      SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'
    `;

    if (tableCount === 0) {
      console.error('Database is empty. Run `npm run db:migrate` instead of adopting a baseline.');
      process.exit(1);
    }

    await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
    await sql`
      CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `;

    const existing = await sql`SELECT hash FROM drizzle."__drizzle_migrations"`;
    const known = new Set(existing.map((r) => r.hash));
    const missing = entries.filter((e) => !known.has(e.hash));

    console.log(`public tables: ${tableCount}`);
    console.log(`journal entries: ${entries.length}, already recorded: ${entries.length - missing.length}`);

    if (missing.length === 0) {
      console.log('Nothing to adopt — ledger already matches the journal.');
      return;
    }

    for (const e of missing) {
      console.log(`  ${APPLY ? 'recording' : 'would record'} ${e.tag} (${e.hash.slice(0, 12)}...)`);
      if (APPLY) {
        await sql`
          INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
          VALUES (${e.hash}, ${e.when})
        `;
      }
    }

    console.log(APPLY ? 'Baseline adopted.' : 'Dry run — pass --apply to write.');
  } catch (err) {
    console.error('Adoption failed:', err.message);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
})();
