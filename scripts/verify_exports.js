#!/usr/bin/env node
/*
  Export integrity verifier.

  Asserts that no ballot rows are linked to vote sessions that were never
  submitted — i.e. that exports and tallies can only ever count real ballots.
  A quarantined or abandoned session leaking into an export would silently
  inflate a nominee's count, which is the failure mode this guards against.

  Usage:
    node scripts/verify_exports.js                 # checks every event
    EVENT_ID=<uuid> node scripts/verify_exports.js # checks one event

  Reads DATABASE_URL from .env.local, or the environment if already set.
  Exit codes: 0 pass, 1 verification failed, 2 could not run.
*/

require('dotenv').config({ path: '.env.local' });

const postgres = require('postgres');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const eventId = process.env.EVENT_ID;

  if (!databaseUrl) {
    // Exit 2, not 0. A verification that could not run is not a pass — the old
    // version exited 0 here, so a misconfigured CI job reported success.
    console.error('DATABASE_URL is not set. Cannot verify.');
    process.exit(2);
  }

  const sql = postgres(databaseUrl, { prepare: false, max: 1 });

  try {
    const rows = eventId
      ? await sql`
          SELECT vs.event_id, count(*)::int AS bad_count
          FROM votes v
          JOIN vote_sessions vs ON v.vote_session_id = vs.id
          WHERE vs.event_id = ${eventId} AND vs.status <> 'SUBMITTED'
          GROUP BY vs.event_id
        `
      : await sql`
          SELECT vs.event_id, count(*)::int AS bad_count
          FROM votes v
          JOIN vote_sessions vs ON v.vote_session_id = vs.id
          WHERE vs.status <> 'SUBMITTED'
          GROUP BY vs.event_id
        `;

    const offenders = rows.filter((r) => Number(r.bad_count) > 0);

    if (offenders.length > 0) {
      const total = offenders.reduce((n, r) => n + Number(r.bad_count), 0);
      console.error(
        `Verification FAILED: ${total} ballot row(s) linked to non-SUBMITTED sessions across ${offenders.length} event(s).`
      );
      for (const r of offenders) {
        console.error(`  event ${r.event_id}: ${r.bad_count}`);
      }
      process.exit(1);
    }

    console.log(
      eventId
        ? `Verification PASSED for event ${eventId}.`
        : 'Verification PASSED: no ballots linked to non-SUBMITTED sessions.'
    );
    process.exit(0);
  } catch (err) {
    console.error('Error running verification:', err);
    process.exit(2);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

main();
