import fs from "fs";
import path from "path";
import postgres from "postgres";

// Controlled production smoke test for the voting persistence fix.
// Creates a clearly-labeled disposable event, drives the REAL deployed
// production API over HTTPS, asserts database state, then deletes the
// fixture (cascades). Touches no pre-existing rows.

const envPath = path.join(process.cwd(), ".env.local");
const line = fs.readFileSync(envPath, "utf8").split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
const url = line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
const sql = postgres(url, { prepare: false, max: 1 });

const BASE = "https://awardos-alpha.vercel.app";
const tag = `smoke-${Date.now().toString(36)}`;
const slug = `smoke-vote-${tag}`;
let userId, workspaceId, eventId, categoryId, nomineeId;

const results = [];
const check = (name, ok, detail = "") => {
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

try {
  // ---- Fixture (disposable, labeled) ----
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
  const nom = await sql`INSERT INTO nominees (event_id, category_id, name, normalized_name, display_order, status) VALUES (${eventId}, ${categoryId}, 'Smoke Nominee', 'smoke nominee', 1, 'ACTIVE') RETURNING id`;
  nomineeId = nom[0].id;
  console.log(`fixture: event=${slug}`);

  const sessionId = `sess_smoke_${tag}`;

  // ---- Step 1: ballot-session init (page load equivalent) ----
  const initRes = await fetch(`${BASE}/api/public/events/${slug}/ballot-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  check("ballot-session init returns 200", initRes.status === 200, `status=${initRes.status}`);
  const initRows = await sql`SELECT status::text AS s FROM vote_sessions WHERE event_id = ${eventId}`;
  check("IN_PROGRESS session created", initRows.length === 1 && initRows[0].s === "IN_PROGRESS", `rows=${initRows.length}`);

  // ---- Step 2: submit the ballot through PRODUCTION ----
  const voteRes = await fetch(`${BASE}/api/public/events/${slug}/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      votes: [{ categoryId, nomineeId, skipped: false }],
    }),
  });
  const voteBody = await voteRes.json();
  check("submission returns 200", voteRes.status === 200, `status=${voteRes.status} body=${JSON.stringify(voteBody).slice(0, 120)}`);
  check("receipt issued", typeof voteBody.receipt === "string" && voteBody.receipt.startsWith("awardos."));

  // ---- Step 3: database is the source of truth ----
  const sessions = await sql`SELECT id, status::text AS s, categories_voted AS cv FROM vote_sessions WHERE event_id = ${eventId}`;
  const submitted = sessions.filter((r) => r.s === "SUBMITTED");
  check("exactly one SUBMITTED session in database", submitted.length === 1, `sessions=${sessions.length}`);
  const voteRows = await sql`SELECT category_id, nominee_id, skipped FROM votes WHERE event_id = ${eventId}`;
  check(
    "vote row persisted correctly",
    voteRows.length === 1 && voteRows[0].category_id === categoryId && voteRows[0].nominee_id === nomineeId && voteRows[0].skipped === false,
    `votes=${voteRows.length}`,
  );

  // ---- Step 4: duplicate submission must be rejected ----
  const dupRes = await fetch(`${BASE}/api/public/events/${slug}/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      votes: [{ categoryId, nomineeId, skipped: false }],
    }),
  });
  check("duplicate submission rejected (409)", dupRes.status === 409, `status=${dupRes.status}`);
  const afterDup = await sql`SELECT count(*)::int AS n FROM votes WHERE event_id = ${eventId}`;
  check("no extra vote rows after duplicate", afterDup[0].n === 1, `votes=${afterDup[0].n}`);

  // ---- Step 5: fresh token, same device/IP → still rejected by fingerprint ----
  const freshInit = await fetch(`${BASE}/api/public/events/${slug}/ballot-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: `sess_smoke_fresh_${tag}` }),
  });
  const freshRes = await fetch(`${BASE}/api/public/events/${slug}/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: `sess_smoke_fresh_${tag}`,
      votes: [{ categoryId, nomineeId, skipped: false }],
    }),
  });
  check("cleared-storage retry rejected server-side", freshRes.status === 409, `init=${freshInit.status} submit=${freshRes.status}`);
} catch (err) {
  check("smoke run completed without exception", false, String(err?.message ?? err));
} finally {
  // ---- Cleanup: remove ONLY the disposable fixture (full cascade) ----
  let cleaned = false;
  try {
    if (eventId) await sql`DELETE FROM events WHERE id = ${eventId}`;
    if (workspaceId) await sql`DELETE FROM workspaces WHERE id = ${workspaceId}`;
    if (userId) await sql`DELETE FROM users WHERE id = ${userId}`;
    cleaned = true;
  } catch (e) {
    console.log("CLEANUP ERROR:", String(e?.message ?? e));
  }
  await sql.end();
  console.log(results.join("\n"));
  console.log(cleaned ? "CLEANUP: fixture removed (cascade)" : "CLEANUP: INCOMPLETE — manual removal needed");
  process.exit(results.every((r) => r.startsWith("PASS")) ? 0 : 1);
}
