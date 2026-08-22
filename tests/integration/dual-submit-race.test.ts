import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  createTestDb,
  truncateAll,
  seedVotingFixture,
  type TestDb,
} from "../helpers/db";

/**
 * P4-1 — concurrent double-submit ballot integrity.
 *
 * Production dual-fire probe (2026-08-22) proved two racers carrying the same
 * localStorage sessionId can interleave inside POST /api/public/events/[slug]/votes.
 * The loser re-promotes the same IN_PROGRESS row (the promote UPDATE matches on
 * id alone), then collides with the winner's committed vote row on
 * unq_vote_session_category.
 *
 * Two defects follow:
 *   D2 (voter-facing, live-observed): drizzle-orm 0.45 wraps PG errors in
 *       DrizzleQueryError with the original error on .cause, so the route's
 *       `error.code` check never sees 23505 — a genuine conflict was served as
 *       HTTP 500 "Internal server error submitting ballot".
 *   D1 (latent): the id-only promote UPDATE lets a stale racer overwrite a
 *       submitted session; only the composite unique index stands between that
 *       and duplicated ballots.
 *
 * PGlite runs single-connection, so true parallel interleave is not locally
 * reproducible. These tests pin the deterministic equivalents instead: the
 * exact post-lock state the losing racer acts on, the error shape our stack
 * actually throws, and the SQL predicate that must reject stale promotion.
 * The real-interleave proof lives in scripts/production-probe-dual-submit.mjs
 * against production Postgres.
 */

let db: TestDb;

const jsonRequest = (url: string, body: unknown, ip = "203.0.113.50") =>
  new NextRequest(`http://localhost:3000${url}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      "user-agent": "vitest",
    },
    body: JSON.stringify(body),
  });

let votesRoute: {
  POST: (request: NextRequest, ctx: { params: Promise<{ slug: string }> }) => Promise<Response>;
};
let ballotSessionRoute: {
  POST: (request: NextRequest, ctx: { params: Promise<{ slug: string }> }) => Promise<Response>;
};

beforeAll(async () => {
  db = await createTestDb();

  const { drizzle } = await import("drizzle-orm/pglite");
  const schema = await import("@/lib/db/schema");
  const mockDb = drizzle(db as never, { schema } as never);
  vi.doMock("@/lib/db", () => ({ db: mockDb }));

  votesRoute = await import("@/app/api/public/events/[slug]/votes/route");
  ballotSessionRoute = await import(
    "@/app/api/public/events/[slug]/ballot-session/route"
  );
});

afterEach(async () => {
  await truncateAll(db);
});

async function initSession(fx: Awaited<ReturnType<typeof seedVotingFixture>>, sessionId: string) {
  const res = await ballotSessionRoute.POST(
    jsonRequest(`/api/public/events/${fx.slug}/ballot-session`, { sessionId }),
    { params: Promise.resolve({ slug: fx.slug }) }
  );
  expect(res.status).toBe(200);
}

describe("P4-1 concurrent double-submit integrity", () => {
  it("a racer colliding with committed votes gets 409, not 500", async () => {
    // Loser's end-state, made deterministic: its snapshot still shows the
    // session IN_PROGRESS, but the winner's vote row for the same category is
    // already committed. The loser promotes, inserts, and hits
    // unq_vote_session_category — wrapped by DrizzleQueryError.
    const fx = await seedVotingFixture(db, { verificationMethod: "NONE" });
    const sessionId = "sess_p41_collision_loser";
    await initSession(fx, sessionId);

    const row = await db.query<{ id: string }>(
      `SELECT id FROM vote_sessions WHERE event_id = $1 AND status = 'IN_PROGRESS'`,
      [fx.eventId] as never[]
    );
    expect(row.rows).toHaveLength(1);

    // The winner's committed choice, invisible to the loser's earlier reads.
    await db.query(
      `INSERT INTO votes (vote_session_id, event_id, category_id, nominee_id, skipped)
       VALUES ($1, $2, $3, $4, false)`,
      [row.rows[0].id, fx.eventId, fx.categoryId, fx.nomineeId] as never[]
    );

    const res = await votesRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/votes`, {
        sessionId,
        votes: [{ categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false }],
      }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    const body = (await res.json()) as { error?: string };

    // Was: HTTP 500 "Internal server error submitting ballot." — reproduced
    // live in production probe attempt 3.
    expect(res.status).toBe(409);
    expect(body.error).toMatch(/already/i);
  });

  it("documents the stack's real unique-violation shape", async () => {
    // Pins WHY the old catch missed: every write through drizzle-orm 0.45 is
    // wrapped in DrizzleQueryError — .code is undefined at the top level and
    // the PG error travels on .cause. Raw PGlite queries do NOT wrap (their
    // .code is set), which is why SQL-level dedup tests never saw this. The
    // production stack is postgres-js behind the same drizzle pg-core query
    // layer, so the wrapped shape is what the route actually receives. If a
    // future drizzle upgrade changes this, this test flags it before the
    // conflict mapping silently degrades back to 500s.
    const fx = await seedVotingFixture(db);
    const sess = await db.query<{ id: string }>(
      `INSERT INTO vote_sessions
         (event_id, session_token, verification_method, device_fingerprint, ip_address, status, submitted_at)
       VALUES ($1, 'tok_shape', 'NONE', 'fp_shape', '203.0.113.1', 'SUBMITTED', now())
       RETURNING id`,
      [fx.eventId] as never[]
    );
    await db.query(
      `INSERT INTO votes (vote_session_id, event_id, category_id, nominee_id, skipped)
       VALUES ($1, $2, $3, $4, false)`,
      [sess.rows[0].id, fx.eventId, fx.categoryId, fx.nomineeId] as never[]
    );

    // The same insert, through the drizzle instance the routes use.
    const { db: orm } = await import("@/lib/db");
    const { votes: votesTable } = await import("@/lib/db/schema");

    let thrown: unknown;
    try {
      await orm.insert(votesTable).values({
        voteSessionId: sess.rows[0].id,
        eventId: fx.eventId,
        categoryId: fx.categoryId,
        nomineeId: fx.nomineeId,
        skipped: false,
      });
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(Error);
    const err = thrown as {
      code?: unknown;
      query?: unknown;
      cause?: { code?: unknown; constraint?: unknown };
    };
    expect(typeof err.query).toBe("string");
    expect(err.code).toBeUndefined();
    expect(err.cause?.code).toBe("23505");
    // PGlite names the field `constraint`; postgres-js names it
    // `constraint_name` — the mapping layer must accept both.
    expect(err.cause?.constraint).toBe("unq_vote_session_category");
  });

  it("guarded promotion accepts an IN_PROGRESS row exactly once", async () => {
    // UNIT-level pin of the SQL predicate the route now uses for promotion.
    // Under READ COMMITTED this predicate is what makes the losing racer's
    // blocked UPDATE re-evaluate against the winner's committed SUBMITTED row
    // and come up empty, instead of matching on id alone.
    const fx = await seedVotingFixture(db);
    const sess = await db.query<{ id: string }>(
      `INSERT INTO vote_sessions (event_id, session_token, verification_method, device_fingerprint, ip_address, status)
       VALUES ($1, 'tok_guard', 'NONE', 'fp_guard', '203.0.113.9', 'IN_PROGRESS')
       RETURNING id`,
      [fx.eventId] as never[]
    );
    const id = sess.rows[0].id;

    const promote = () =>
      db.query<{ id: string }>(
        `UPDATE vote_sessions SET status = 'SUBMITTED', submitted_at = now()
         WHERE id = $1 AND status = 'IN_PROGRESS'
         RETURNING id`,
        [id] as never[]
      );

    const first = await promote();
    expect(first.rows).toHaveLength(1);
    expect(first.rows[0].id).toBe(id);

    // A second racer arriving after commit — including one whose blocked
    // UPDATE just resumed — must find nothing to promote.
    const second = await promote();
    expect(second.rows).toHaveLength(0);
  });

  it("a clean ballot still submits end to end after the guard", async () => {
    const fx = await seedVotingFixture(db, { verificationMethod: "NONE" });
    const sessionId = "sess_p41_happy_path";
    await initSession(fx, sessionId);

    const res = await votesRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/votes`, {
        sessionId,
        votes: [{ categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false }],
      }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    const body = (await res.json()) as { receipt?: string; error?: string };

    expect(res.status).toBe(200);
    expect(body.receipt).toBeTruthy();
    expect(body.error).toBeUndefined();

    const votes = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM votes WHERE event_id = $1`,
      [fx.eventId] as never[]
    );
    expect(votes.rows[0].n).toBe(1);
  });
});
