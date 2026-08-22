import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  createTestDb,
  truncateAll,
  seedVotingFixture,
  type TestDb,
} from "../helpers/db";

/**
 * P4-2 — voting-window boundaries at the route level.
 *
 * Intended AwardOS semantics (documented, pinned here):
 *   1. The window is evaluated server-side from pre-transaction reads; a close
 *      committed after a request's checks cannot revoke that request. That
 *      residual check-then-write gap is accepted by design — the mitigation is
 *      the IN_PROGRESS grace period, not distributed locking of ballots
 *      against stage transitions.
 *   2. Closing the stage window (ends_at) soft-closes: sessions that started
 *      before the deadline keep a 15-minute submission grace.
 *   3. Completing the EVENT hard-stops: grace is revoked immediately.
 *
 * PGlite cannot interleave a concurrent organizer close with an in-flight
 * ballot, so ordering (1) is argued statically in the ledger; everything else
 * here is exercised end to end through the real handlers under a faked clock.
 */

let db: TestDb;

const jsonRequest = (url: string, body: unknown, ip = "203.0.113.60") =>
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
  vi.useRealTimers();
});

afterAll(() => {
  vi.useRealTimers();
});

const ENDS_AT = "2026-08-15T11:00:00Z";

async function fixtureWithDeadline() {
  const fx = await seedVotingFixture(db, { verificationMethod: "NONE" });
  await db.query(
    `UPDATE workflow_stages SET starts_at = $2, ends_at = $3 WHERE event_id = $1`,
    [fx.eventId, new Date("2026-08-15T10:00:00Z"), new Date(ENDS_AT)] as never[]
  );
  return fx;
}

const submit = (fx: Awaited<ReturnType<typeof fixtureWithDeadline>>, sessionId: string) =>
  votesRoute.POST(
    jsonRequest(`/api/public/events/${fx.slug}/votes`, {
      sessionId,
      votes: [{ categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false }],
    }),
    { params: Promise.resolve({ slug: fx.slug }) }
  );

const init = (fx: Awaited<ReturnType<typeof fixtureWithDeadline>>, sessionId: string) =>
  ballotSessionRoute.POST(
    jsonRequest(`/api/public/events/${fx.slug}/ballot-session`, { sessionId }),
    { params: Promise.resolve({ slug: fx.slug }) }
  );

describe("P4-2 voting window boundaries", () => {
  it("accepts a ballot at exactly ends_at", async () => {
    const fx = await fixtureWithDeadline();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(ENDS_AT));

    expect((await init(fx, "sess_boundary_exact")).status).toBe(200);
    const res = await submit(fx, "sess_boundary_exact");
    expect(res.status).toBe(200);
  });

  it("rejects fresh sessions one millisecond after close", async () => {
    const fx = await fixtureWithDeadline();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(new Date(ENDS_AT).getTime() + 1));

    const initRes = await init(fx, "sess_after_close");
    expect(initRes.status).toBe(403);

    // Even skipping init, submission itself must refuse.
    const res = await submit(fx, "sess_after_close");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/closed/i);
  });

  it("honors the in-progress grace for sessions started before close", async () => {
    const fx = await fixtureWithDeadline();

    // Session initialized while voting was open.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T10:59:00Z"));
    expect((await init(fx, "sess_grace_keeper")).status).toBe(200);

    // Ten minutes after close: still inside the 15-minute grace.
    vi.setSystemTime(new Date(new Date(ENDS_AT).getTime() + 10 * 60_000));
    const res = await submit(fx, "sess_grace_keeper");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { receipt?: string };
    expect(body.receipt).toBeTruthy();
  });

  it("expires the grace exactly fifteen minutes after close", async () => {
    const fx = await fixtureWithDeadline();

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T10:59:00Z"));
    expect((await init(fx, "sess_grace_late")).status).toBe(200);

    vi.setSystemTime(new Date(new Date(ENDS_AT).getTime() + 15 * 60_000 + 1));
    const res = await submit(fx, "sess_grace_late");
    expect(res.status).toBe(403);
  });

  it("revokes grace immediately when the event is completed", async () => {
    const fx = await fixtureWithDeadline();

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T10:59:00Z"));
    expect((await init(fx, "sess_hard_stop")).status).toBe(200);

    // Operator hard-stops the event mid-grace.
    vi.setSystemTime(new Date(new Date(ENDS_AT).getTime() + 5 * 60_000));
    await db.query(`UPDATE events SET status = 'COMPLETED' WHERE id = $1`, [fx.eventId] as never[]);

    const res = await submit(fx, "sess_hard_stop");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/not currently open/i);
  });
});
