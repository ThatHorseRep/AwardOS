#!/usr/bin/env node
/*
  Simple verifier: connects to the database (DATABASE_URL env) and checks
  whether any votes for the given EVENT_ID are linked to vote_sessions
  whose status != 'SUBMITTED'. Exit code 1 on failure.

  Usage:
    DATABASE_URL=postgres://... EVENT_ID=<event id> node scripts/verify_exports.js

  If DATABASE_URL is not set, the script will exit with instructions.
*/

const { Client } = require('postgres');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const eventId = process.env.EVENT_ID;

  if (!databaseUrl) {
    console.error('DATABASE_URL not set. Skipping DB verification.');
    console.error('Provide a Postgres connection string to run this verifier.');
    process.exit(0);
  }

  if (!eventId) {
    console.error('EVENT_ID not set. Please set EVENT_ID to run verification against an event.');
    process.exit(1);
  }

  const sql = new Client(databaseUrl);

  try {
    await sql.connect();

    const query = `SELECT count(*) AS bad_count FROM votes v INNER JOIN vote_sessions vs ON v.vote_session_id = vs.id WHERE vs.event_id = $1 AND vs.status != 'SUBMITTED'`;
    const res = await sql.query(query, [eventId]);
    const bad = Number(res.rows[0].bad_count || 0);

    if (bad > 0) {
      console.error(`Verification FAILED: ${bad} ballot rows are linked to non-SUBMITTED sessions for event ${eventId}.`);
      process.exit(1);
    } else {
      console.log(`Verification PASSED: No ballots linked to non-SUBMITTED sessions for event ${eventId}.`);
      process.exit(0);
    }
  } catch (err) {
    console.error('Error running verification:', err);
    process.exit(2);
  } finally {
    try { await sql.end(); } catch (e) {}
  }
}

main();
