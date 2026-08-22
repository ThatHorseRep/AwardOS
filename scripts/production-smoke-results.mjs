import fs from "fs";
import path from "path";
import postgres from "postgres";

// Controlled production verification of P3-F1 (published results must freeze)
// against the REAL deployed application.
//
// Creates a clearly-labeled disposable fixture whose database state matches
// exactly what publishResultsAction produces (official_results snapshot +
// FULL_LEADERBOARD), invokes the deployed public-results server action over
// HTTPS, then mutates live vote rows and asserts the public payload did NOT
// move. Touches no pre-existing rows; removes the fixture at the end.

const envPath = path.join(process.cwd(), ".env.local");
const line = fs.readFileSync(envPath, "utf8").split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
const url = line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
const sql = postgres(url, { prepare: false, max: 1 });

const BASE = "https://awardos-alpha.vercel.app";
const tag = `rsl-${Date.now().toString(36)}`;
const slug = `smoke-results-${tag}`;
const NOM_A = "Smoke Alpha";
const NOM_B = "Smoke Bravo";
let userId, workspaceId, eventId, categoryId, nomAId, nomBId;

const results = [];
const check = (name, ok, detail = "") => {
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

async function castRow(nomineeId, suffix) {
  const s = await sql`INSERT INTO vote_sessions (event_id, session_token, status, submitted_at)
    VALUES (${eventId}, ${`tok_${tag}_${suffix}`}, 'SUBMITTED', now()) RETURNING id`;
  await sql`INSERT INTO votes (vote_session_id, event_id, category_id, nominee_id, skipped)
    VALUES (${s[0].id}, ${eventId}, ${categoryId}, ${nomineeId}, false)`;
}

async function fetchText(u, opts) {
  const res = await fetch(u, opts);
  return { status: res.status, text: await res.text() };
}

try {
  // ---- Fixture (disposable, labeled) ----
  const user = await sql`INSERT INTO users (id, email, display_name) VALUES (gen_random_uuid(), ${`smoke+${tag}@example.com`}, 'SMOKE TEST') RETURNING id`;
  userId = user[0].id;
  const ws = await sql`INSERT INTO workspaces (name, slug, type, created_by) VALUES ('SMOKE TEST', ${`ws-${tag}`}, 'ORGANIZATION', ${userId}) RETURNING id`;
  workspaceId = ws[0].id;
  await sql`INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES (${workspaceId}, ${userId}, 'OWNER', 'ACTIVE')`;
  const ev = await sql`
    INSERT INTO events (workspace_id, name, slug, status, visibility, verification_config, created_by, live_results_mode)
    VALUES (${workspaceId}, 'SMOKE TEST EVENT — DELETE ME', ${slug}, 'ACTIVE', 'PUBLIC', '{"method":"NONE"}', ${userId}, 'HIDDEN')
    RETURNING id`;
  eventId = ev[0].id;
  await sql`
    INSERT INTO workflow_stages (event_id, stage_type, display_name, status, display_order, starts_at, ends_at)
    VALUES (${eventId}, 'VOTING', 'Voting', 'COMPLETED', 1, now() - interval '2 hours', now() - interval '1 hour')`;
  const cat = await sql`INSERT INTO categories (event_id, name, display_order) VALUES (${eventId}, 'Smoke Category', 1) RETURNING id`;
  categoryId = cat[0].id;
  const a = await sql`INSERT INTO nominees (event_id, category_id, name, normalized_name, display_order, status) VALUES (${eventId}, ${categoryId}, ${NOM_A}, 'smoke-alpha', 1, 'ACTIVE') RETURNING id`;
  nomAId = a[0].id;
  const b = await sql`INSERT INTO nominees (event_id, category_id, name, normalized_name, display_order, status) VALUES (${eventId}, ${categoryId}, ${NOM_B}, 'smoke-bravo', 2, 'ACTIVE') RETURNING id`;
  nomBId = b[0].id;

  // Live ballots: A=2, B=1.
  await castRow(nomAId, "a1");
  await castRow(nomAId, "a2");
  await castRow(nomBId, "b1");

  // Published state, byte-for-byte what publishResultsAction writes: frozen
  // official_results snapshot + disclosure mode on. (The publish action itself
  // is covered by integration tests; this probe targets the DEPLOYED public
  // read path.)
  await sql`INSERT INTO official_results (event_id, category_id, nominee_id, raw_vote_count, adjusted_vote_count, final_rank, is_winner, is_disqualified)
    VALUES (${eventId}, ${categoryId}, ${nomAId}, 2, 2, 1, true, false),
           (${eventId}, ${categoryId}, ${nomBId}, 1, 1, 2, false, false)`;
  await sql`UPDATE events SET live_results_mode = 'FULL_LEADERBOARD' WHERE id = ${eventId}`;

  // ---- Locate the deployed public-results server action ----
  const page = await fetchText(`${BASE}/e/${slug}/results`);
  if (page.status !== 200) throw new Error(`results page HTTP ${page.status}`);
  const chunkUrls = [...page.text.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]);
  const ids = new Set();
  for (const cu of chunkUrls.slice(0, 80)) {
    const abs = cu.startsWith("http") ? cu : `${BASE}${cu}`;
    const js = await fetch(abs).then((r) => (r.ok ? r.text() : "")).catch(() => "");
    for (const m of js.matchAll(/(?:createServerReference|registerServerReference)\)?\(\s*"([0-9a-f]{40,})"/g)) {
      ids.add(m[1]);
    }
  }
  check("deployed server action ids discoverable", ids.size > 0, `candidates=${ids.size} chunks=${chunkUrls.length}`);

  async function invokeResultsAction() {
    for (const id of ids) {
      try {
        const res = await fetch(`${BASE}/e/${slug}/results`, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=UTF-8", "Next-Action": id },
          body: JSON.stringify([slug]),
        });
        if (!res.ok) continue;
        const text = await res.text();
        if (text.includes(NOM_A) && text.includes(NOM_B)) {
          return text;
        }
      } catch {
        // Wrong id or non-invokable reference — harmless for an
        // unauthenticated caller; every mutating action is RBAC-gated.
      }
    }
    return null;
  }

  const payload1 = await invokeResultsAction();
  check("public results action reachable over HTTPS", payload1 !== null);

  const frozenOk =
    payload1 !== null &&
    payload1.indexOf(NOM_A) < payload1.indexOf(NOM_B);
  check("published leaderboard serves snapshot order (Alpha rank 1)", frozenOk === true);

  // ---- Mutate LIVE truth after publication ----
  for (let i = 0; i < 5; i++) await castRow(nomBId, `late${i}`);

  const payload2 = await invokeResultsAction();
  check(
    "post-publication votes do NOT move published results",
    payload2 !== null && payload2.indexOf(NOM_A) < payload2.indexOf(NOM_B),
    payload2 ? "" : "action unreachable",
  );
} catch (err) {
  check("probe completed without exception", false, String(err?.message ?? err));
} finally {
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
  process.exit(results.every((r) => r.startsWith("PASS")) || results.some((r) => r.startsWith("FAIL")) ? (results.every((r) => r.startsWith("PASS")) ? 0 : 1) : 0);
}
