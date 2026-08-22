import fs from "fs";
import path from "path";
import postgres from "postgres";

// P4-1 live RED capture: fires TWO simultaneous ballot submissions carrying
// the SAME sessionId (two tabs sharing localStorage) at the REAL deployed
// production API. Under correct serialization exactly one is accepted and
// exactly one vote row exists. If the promote-UPDATE race is live, both are
// accepted and duplicate vote rows appear. Disposable labeled fixtures only;
// up to 3 attempts (fresh event each); cleans everything afterward.

const envPath = path.join(process.cwd(), ".env.local");
const line = fs.readFileSync(envPath, "utf8").split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
const url = line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
const sql = postgres(url, { prepare: false, max: 1 });

const BASE = "https://awardos-alpha.vercel.app";
const MAX_ATTEMPTS = 3;

async function runAttempt(n) {
  const tag = `dualsubmit-${Date.now().toString(36)}-${n}`;
  const slug = `smoke-dual-${tag}`;
  let userId, workspaceId, eventId, categoryId, nomineeAId, nomineeBId;
  try {
    const user = await sql`INSERT INTO users (id, email, display_name) VALUES (gen_random_uuid(), ${`smoke+${tag}@example.com`}, 'SMOKE TEST') RETURNING id`;
    userId = user[0].id;
    const ws = await sql`INSERT INTO workspaces (name, slug, type, created_by) VALUES ('SMOKE TEST', ${`ws-${tag}`}, 'ORGANIZATION', ${userId}) RETURNING id`;
    workspaceId = ws[0].id;
    await sql`INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES (${workspaceId}, ${userId}, 'OWNER', 'ACTIVE')`;
    const ev = await sql`
      INSERT INTO events (workspace_id, name, slug, status, visibility, verification_config, created_by)
      VALUES (${workspaceId}, 'SMOKE TEST EVENT — DELETE ME', ${slug}, 'ACTIVE', 'PUBLIC', '{"method":"NONE"}', ${userId})
      RETURNING id`;
    eventId = ev[0].id;
    await sql`
      INSERT INTO workflow_stages (event_id, stage_type, display_name, status, display_order, starts_at, ends_at)
      VALUES (${eventId}, 'VOTING', 'Voting', 'ACTIVE', 1, now() - interval '1 hour', now() + interval '24 hours')`;
    const cat = await sql`INSERT INTO categories (event_id, name, display_order) VALUES (${eventId}, 'Smoke Category', 1) RETURNING id`;
    categoryId = cat[0].id;
    const na = await sql`INSERT INTO nominees (event_id, category_id, name, normalized_name, display_order, status) VALUES (${eventId}, ${categoryId}, 'Alpha', 'alpha', 1, 'ACTIVE') RETURNING id`;
    nomineeAId = na[0].id;
    const nb = await sql`INSERT INTO nominees (event_id, category_id, name, normalized_name, display_order, status) VALUES (${eventId}, ${categoryId}, 'Bravo', 'bravo', 2, 'ACTIVE') RETURNING id`;
    nomineeBId = nb[0].id;

    const sessionId = `sess_${tag}`;
    const initRes = await fetch(`${BASE}/api/public/events/${slug}/ballot-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const initRow = await sql`SELECT session_token FROM vote_sessions WHERE event_id = ${eventId}`;
    console.log(`attempt ${n}: event=${slug} init=${initRes.status} token=${initRow[0]?.session_token}`);

    // ---- THE RACE: two simultaneous submissions, same sessionId ----
    const post = (nomineeId) =>
      fetch(`${BASE}/api/public/events/${slug}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          votes: [{ categoryId, nomineeId, skipped: false }],
        }),
      }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

    const [ra, rb] = await Promise.all([post(nomineeAId), post(nomineeBId)]);
    console.log(`  responses: A=${ra.status} B=${rb.status}`);
    console.log(`  bodies: A=${JSON.stringify(ra.body).slice(0, 100)} B=${JSON.stringify(rb.body).slice(0, 100)}`);

    const sessions = await sql`SELECT status::text AS s, categories_voted AS cv FROM vote_sessions WHERE event_id = ${eventId}`;
    const voteRows = await sql`SELECT nominee_id FROM votes WHERE event_id = ${eventId}`;
    const accepted = [ra, rb].filter((r) => r.status === 200).length;
    const submitted = sessions.filter((r) => r.s === "SUBMITTED").length;

    console.log(`  db: sessions=${sessions.length} submitted=${submitted} voteRows=${voteRows.length}`);
    console.log(`  verdict attempt ${n}: accepted=${accepted} vote_rows=${voteRows.length}`);

    if (voteRows.length > 1 || submitted > 1) {
      console.log(`  >>> RACE REPRODUCED LIVE: ${voteRows.length} vote rows from ONE voter token`);
      return { reproduced: true };
    }
    return { reproduced: false };
  } finally {
    try {
      if (eventId) await sql`DELETE FROM events WHERE id = ${eventId}`;
      if (workspaceId) await sql`DELETE FROM workspaces WHERE id = ${workspaceId}`;
      if (userId) await sql`DELETE FROM users WHERE id = ${userId}`;
      console.log(`  cleanup attempt ${n}: OK`);
    } catch (e) {
      console.log(`  CLEANUP ERROR attempt ${n}: ${String(e?.message ?? e)} (event=${eventId})`);
    }
  }
}

let reproduced = false;
for (let i = 1; i <= MAX_ATTEMPTS && !reproduced; i++) {
  reproduced = (await runAttempt(i)).reproduced;
}
await sql.end();
console.log(reproduced ? "\nRESULT: RACE REPRODUCED ON PRODUCTION (RED)" : "\nRESULT: race not observed this run (timing-dependent)");
process.exit(0);
