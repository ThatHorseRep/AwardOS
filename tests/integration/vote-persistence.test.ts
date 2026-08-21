import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  createTestDb,
  truncateAll,
  seedVotingFixture,
  type TestDb,
} from "../helpers/db";

/**
 * End-to-end vote persistence through the real HTTP route handlers.
 *
 * The earlier dedup tests insert vote_sessions with raw SQL and never drive
 * POST /api/public/events/[slug]/votes, so they cannot see defects in the
 * route itself. These tests run the actual handler code — ballot-session
 * initialization followed by ballot submission, exactly as the browser does —
 * against a real Postgres (PGlite), then assert on database state rather than
 * on HTTP success alone.
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

type Routes = typeof import("@/app/api/public/events/[slug]/votes/route");

let votesRoute: Routes;
let ballotSessionRoute: {
  POST: (request: NextRequest, ctx: { params: Promise<{ slug: string }> }) => Promise<Response>;
};

beforeAll(async () => {
  db = await createTestDb();

  // Point the shared @/lib/db module at the test database so the real route
  // handlers exercise their genuine query/transaction code paths.
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

async function sessionState(eventId: string) {
  const res = await db.query<{
    id: string;
    status: string;
    token: string;
  }>(
    `SELECT id, status::text AS status, session_token AS token FROM vote_sessions WHERE event_id = $1`,
    [eventId] as never[]
  );
  return res.rows;
}

async function persistedVotes(eventId: string) {
  const res = await db.query<{
    category_id: string;
    nominee_id: string | null;
    skipped: boolean;
  }>(
    `SELECT category_id, nominee_id, skipped FROM votes WHERE event_id = $1`,
    [eventId] as never[]
  );
  return res.rows;
}

describe("vote persistence through the public API", () => {
  it("persists a first-time NONE-mode ballot end to end", async () => {
    const fx = await seedVotingFixture(db, { verificationMethod: "NONE" });
    const sessionId = "sess_repro_first_ballot";

    // Step 1 — page load initializes the ballot session (status IN_PROGRESS).
    const initRes = await ballotSessionRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/ballot-session`, { sessionId }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    expect(initRes.status).toBe(200);

    // The initialization row must exist before submission, exactly as in
    // production where every ballot page load creates it.
    const before = await sessionState(fx.eventId);
    expect(before).toHaveLength(1);
    expect(before[0].status).toBe("IN_PROGRESS");

    // Step 2 — submit the ballot.
    const submitRes = await votesRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/votes`, {
        sessionId,
        votes: [{ categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false }],
      }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    const body = (await submitRes.json()) as { error?: string; receipt?: string };

    // THE REGRESSION: this used to return 409 "You have already cast a ballot"
    // because the guard matched the voter's own IN_PROGRESS initialization
    // session, while the client treated 409 + "already cast" as a duplicate-
    // vote redirect to the thank-you page — a false success with nothing
    // persisted.
    expect(submitRes.status).toBe(200);
    expect(body.error).toBeUndefined();
    expect(body.receipt).toBeTruthy();

    // Step 3 — the database is the source of truth.
    const sessions = await sessionState(fx.eventId);
    const submitted = sessions.find((s) => s.status === "SUBMITTED");
    expect(submitted).toBeTruthy();

    const votes = await persistedVotes(fx.eventId);
    expect(votes).toHaveLength(1);
    expect(votes[0].category_id).toBe(fx.categoryId);
    expect(votes[0].nominee_id).toBe(fx.nomineeId);
    expect(votes[0].skipped).toBe(false);
  });

  it("rejects a second submission of an already-submitted session token", async () => {
    const fx = await seedVotingFixture(db, { verificationMethod: "NONE" });
    const sessionId = "sess_repro_second_ballot";

    await ballotSessionRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/ballot-session`, { sessionId }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );

    const payload = {
      sessionId,
      votes: [{ categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false }],
    };

    const first = await votesRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/votes`, payload),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    expect(first.status).toBe(200);

    // A replayed submission must be rejected server-side...
    const second = await votesRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/votes`, payload),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    expect(second.status).toBe(409);

    // ...and must not have created a second ballot or extra vote rows.
    const submitted = (await sessionState(fx.eventId)).filter(
      (s) => s.status === "SUBMITTED"
    );
    expect(submitted).toHaveLength(1);
    expect(await persistedVotes(fx.eventId)).toHaveLength(1);
  });

  it("survives two concurrent submissions sharing one initialized session", async () => {
    const fx = await seedVotingFixture(db, { verificationMethod: "NONE" });
    const sessionId = "sess_repro_concurrent";

    await ballotSessionRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/ballot-session`, { sessionId }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );

    const attempt = () =>
      votesRoute.POST(
        jsonRequest(`/api/public/events/${fx.slug}/votes`, {
          sessionId,
          votes: [
            { categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false },
          ],
        }),
        { params: Promise.resolve({ slug: fx.slug }) }
      );

    const results = await Promise.all([attempt(), attempt()]);
    const ok = results.filter((r) => r.status === 200).length;
    expect(ok).toBe(1);

    const submitted = (await sessionState(fx.eventId)).filter(
      (s) => s.status === "SUBMITTED"
    );
    expect(submitted).toHaveLength(1);
    expect(await persistedVotes(fx.eventId)).toHaveLength(1);
  });

  it("issues a receipt that verifies against the persisted session", async () => {
    const fx = await seedVotingFixture(db, { verificationMethod: "NONE" });
    const sessionId = "sess_repro_receipt";

    await ballotSessionRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/ballot-session`, { sessionId }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );

    const res = await votesRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/votes`, {
        sessionId,
        votes: [{ categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false }],
      }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    const body = (await res.json()) as { receipt?: string };
    expect(body.receipt).toBeTruthy();

    const { verifyBallotReceiptAction } = await import("@/actions/voting");
    const verification = await verifyBallotReceiptAction(fx.slug, body.receipt!);
    expect(verification.valid).toBe(true);
  });

  it("persists skipped categories explicitly on a multi-category ballot", async () => {
    const fx = await seedVotingFixture(db, { verificationMethod: "NONE" });

    // A second category so the ballot spans selected + skipped responses.
    const extra = await db.query<{ id: string }>(
      `INSERT INTO categories (event_id, name, display_order) VALUES ($1, 'Second Best', 2) RETURNING id`,
      [fx.eventId] as never[]
    );
    await db.query(
      `INSERT INTO nominees (event_id, category_id, name, normalized_name, display_order, status)
       VALUES ($1, $2, 'Bob', 'bob', 1, 'ACTIVE')`,
      [fx.eventId, extra.rows[0].id] as never[]
    );

    const sessionId = "sess_repro_skip";
    await ballotSessionRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/ballot-session`, { sessionId }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );

    const res = await votesRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/votes`, {
        sessionId,
        votes: [
          { categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false },
          { categoryId: extra.rows[0].id, nomineeId: null, skipped: true },
        ],
      }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    expect(res.status).toBe(200);

    const votes = await persistedVotes(fx.eventId);
    expect(votes).toHaveLength(2);

    const selected = votes.find((v) => v.category_id === fx.categoryId);
    expect(selected?.nominee_id).toBe(fx.nomineeId);
    expect(selected?.skipped).toBe(false);

    const skipped = votes.find((v) => v.category_id === extra.rows[0].id);
    expect(skipped?.nominee_id).toBeNull();
    expect(skipped?.skipped).toBe(true);

    const session = (await sessionState(fx.eventId)).find((s) => s.status === "SUBMITTED");
    expect(session).toBeTruthy();
    const counts = await db.query<{ categories_voted: number; categories_skipped: number }>(
      `SELECT categories_voted, categories_skipped FROM vote_sessions WHERE id = $1`,
      [session!.id] as never[]
    );
    expect(counts.rows[0].categories_voted).toBe(1);
    expect(counts.rows[0].categories_skipped).toBe(1);
  });

  it("surfaces the persisted ballot to Voting Activity accounting", async () => {
    const fx = await seedVotingFixture(db, { verificationMethod: "NONE" });
    const sessionId = "sess_repro_activity";

    await ballotSessionRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/ballot-session`, { sessionId }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    const res = await votesRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/votes`, {
        sessionId,
        votes: [{ categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false }],
      }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    expect(res.status).toBe(200);

    const { getEventVoteAccounting } = await import("@/lib/voting/accounting");
    const accounting = await getEventVoteAccounting(fx.eventId);
    expect(accounting.submittedBallots).toBe(1);
    expect(accounting.selectedVotes).toBe(1);
    expect(accounting.skippedResponses).toBe(0);
    expect(accounting.categories[0].selectedVotes).toBe(1);
  });

  it("counts the persisted ballot in results tabulation", async () => {
    const fx = await seedVotingFixture(db, { verificationMethod: "NONE" });
    const sessionId = "sess_repro_results";

    await ballotSessionRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/ballot-session`, { sessionId }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    const res = await votesRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/votes`, {
        sessionId,
        votes: [{ categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false }],
      }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    expect(res.status).toBe(200);

    // Public results default to HIDDEN; expose full counts for the assertion.
    await db.query(`UPDATE events SET live_results_mode = 'FULL_LEADERBOARD' WHERE id = $1`, [
      fx.eventId,
    ] as never[]);

    const { getPublicEventResultsAction } = await import("@/actions/results");
    const results = await getPublicEventResultsAction(fx.slug);
    expect(results).toBeTruthy();
    const category = results!.categoriesResults[0];
    expect(category.winners[0].id).toBe(fx.nomineeId);
    expect(category.winners[0].votes).toBe(1);
    expect(category.totalVotes).toBe(1);
  });

  it("rejects a ballot from a cleared browser state on the same device", async () => {
    // Clearing localStorage mints a fresh session token, but the server-side
    // device fingerprint (IP-derived) must still block the second ballot.
    const fx = await seedVotingFixture(db, { verificationMethod: "NONE" });

    const firstSession = "sess_repro_original";
    await ballotSessionRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/ballot-session`, { sessionId: firstSession }, "198.51.100.7"),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    const first = await votesRoute.POST(
      jsonRequest(
        `/api/public/events/${fx.slug}/votes`,
        {
          sessionId: firstSession,
          votes: [{ categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false }],
        },
        "198.51.100.7"
      ),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    expect(first.status).toBe(200);

    // "Cleared" browser: brand-new session token, same network address.
    const freshSession = "sess_repro_after_clear";
    await ballotSessionRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/ballot-session`, { sessionId: freshSession }, "198.51.100.7"),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    const second = await votesRoute.POST(
      jsonRequest(
        `/api/public/events/${fx.slug}/votes`,
        {
          sessionId: freshSession,
          votes: [{ categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false }],
        },
        "198.51.100.7"
      ),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    expect(second.status).toBe(409);

    const submitted = (await sessionState(fx.eventId)).filter((s) => s.status === "SUBMITTED");
    expect(submitted).toHaveLength(1);
    expect(await persistedVotes(fx.eventId)).toHaveLength(1);
  });

  it("never returns a receipt when persistence fails", async () => {
    const fx = await seedVotingFixture(db, { verificationMethod: "NONE" });
    const sessionId = "sess_repro_no_receipt";

    await ballotSessionRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/ballot-session`, { sessionId }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );

    // First ballot succeeds and consumes the voter identity.
    const first = await votesRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/votes`, {
        sessionId,
        votes: [{ categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false }],
      }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    expect(first.status).toBe(200);

    // A replayed ballot is rejected and its response carries no receipt that
    // could be mistaken for a successful cast.
    const second = await votesRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/votes`, {
        sessionId,
        votes: [{ categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false }],
      }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    const body = (await second.json()) as { receipt?: string };
    expect(second.status).toBe(409);
    expect(body.receipt).toBeUndefined();
  });

  it("sets the HTTP-only voted cookie on success", async () => {
    const fx = await seedVotingFixture(db, { verificationMethod: "NONE" });
    const sessionId = "sess_repro_cookie";

    await ballotSessionRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/ballot-session`, { sessionId }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );

    const res = await votesRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/votes`, {
        sessionId,
        votes: [{ categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false }],
      }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    expect(res.status).toBe(200);

    const cookies = res.headers.getSetCookie?.() ?? [];
    const voted = cookies.find((c) => c.startsWith(`awardos_voted_${fx.slug}=`));
    expect(voted).toBeTruthy();
    expect(voted).toContain("HttpOnly");
    expect(voted).toContain(`Path=/e/${fx.slug}`);
  });
});

describe("verified-mode submissions through the public API", () => {
  async function seedVerifiedOtp(eventId: string, email: string) {
    const res = await db.query<{ id: string }>(
      `INSERT INTO voter_otps (event_id, email, code_hash, expires_at, verified)
       VALUES ($1, $2, 'x', now() + interval '10 minutes', true) RETURNING id`,
      [eventId, email] as never[]
    );
    return res.rows[0].id;
  }

  it("persists an EMAIL_OTP ballot and consumes the OTP", async () => {
    const fx = await seedVotingFixture(db, { verificationMethod: "EMAIL_OTP" });
    const email = "otp-voter@example.com";
    const otpId = await seedVerifiedOtp(fx.eventId, email);
    const sessionId = "sess_repro_otp_first";

    await ballotSessionRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/ballot-session`, { sessionId }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );

    const res = await votesRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/votes`, {
        sessionId,
        verificationSession: { method: "EMAIL_OTP", email, otpId },
        votes: [{ categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false }],
      }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    expect(res.status).toBe(200);

    // Session carries the verified identity...
    const sessions = await db.query<{ status: string; email: string | null; method: string }>(
      `SELECT status::text AS status, verified_email AS email, verification_method::text AS method
       FROM vote_sessions WHERE event_id = $1`,
      [fx.eventId] as never[]
    );
    const submitted = sessions.rows.find((s) => s.status === "SUBMITTED");
    expect(submitted?.email).toBe(email);
    expect(submitted?.method).toBe("EMAIL_OTP");

    // ...the vote row persisted, and the OTP was consumed.
    expect(await persistedVotes(fx.eventId)).toHaveLength(1);
    const otps = await db.query(
      `SELECT id FROM voter_otps WHERE id = $1`,
      [otpId] as never[]
    );
    expect(otps.rows).toHaveLength(0);
  });

  it("rejects a second EMAIL_OTP ballot with the same verified email", async () => {
    const fx = await seedVotingFixture(db, { verificationMethod: "EMAIL_OTP" });
    const email = "repeat-otp@example.com";
    const sessionId = "sess_repro_otp_dup";

    const otpId = await seedVerifiedOtp(fx.eventId, email);
    await ballotSessionRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/ballot-session`, { sessionId }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    const first = await votesRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/votes`, {
        sessionId,
        verificationSession: { method: "EMAIL_OTP", email, otpId },
        votes: [{ categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false }],
      }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    expect(first.status).toBe(200);

    // Fresh browser context, fresh OTP, same person.
    const otpId2 = await seedVerifiedOtp(fx.eventId, email);
    const sessionId2 = "sess_repro_otp_dup_2";
    await ballotSessionRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/ballot-session`, { sessionId: sessionId2 }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    const second = await votesRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/votes`, {
        sessionId: sessionId2,
        verificationSession: { method: "EMAIL_OTP", email, otpId: otpId2 },
        votes: [{ categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false }],
      }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    expect(second.status).toBe(409);

    const submitted = (await sessionState(fx.eventId)).filter((s) => s.status === "SUBMITTED");
    expect(submitted).toHaveLength(1);
    expect(await persistedVotes(fx.eventId)).toHaveLength(1);
  });

  it("blocks re-voting against an invalidated EMAIL_OTP ballot (intended integrity behaviour)", async () => {
    // PINNED, not fixed: the pre-submit email match intentionally ignores
    // status so a FLAGGED/INVALIDATED ballot still blocks the same email from
    // immediately recasting. Only IN_PROGRESS rows could false-positive here,
    // and those never carry a verified_email — it is written atomically with
    // SUBMITTED inside the submission transaction.
    const fx = await seedVotingFixture(db, { verificationMethod: "EMAIL_OTP" });
    const email = "flagged@example.com";
    const otpId = await seedVerifiedOtp(fx.eventId, email);
    const sessionId = "sess_repro_otp_flagged";

    await ballotSessionRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/ballot-session`, { sessionId }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    const first = await votesRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/votes`, {
        sessionId,
        verificationSession: { method: "EMAIL_OTP", email, otpId },
        votes: [{ categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false }],
      }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    expect(first.status).toBe(200);

    // Organizer invalidates the ballot via the integrity tooling.
    await db.query(`UPDATE vote_sessions SET status = 'INVALIDATED' WHERE event_id = $1`, [
      fx.eventId,
    ] as never[]);

    const otpId2 = await seedVerifiedOtp(fx.eventId, email);
    const sessionId2 = "sess_repro_otp_flagged_2";
    await ballotSessionRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/ballot-session`, { sessionId: sessionId2 }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    const second = await votesRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/votes`, {
        sessionId: sessionId2,
        verificationSession: { method: "EMAIL_OTP", email, otpId: otpId2 },
        votes: [{ categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false }],
      }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    expect(second.status).toBe(409);
  });

  it("claims an invitation code atomically and rejects its reuse", async () => {
    const fx = await seedVotingFixture(db, { verificationMethod: "INVITATION_CODE" });
    await db.query(
      `INSERT INTO invitation_codes (event_id, code, status) VALUES ($1, 'INVITE-AAAA', 'UNUSED')`,
      [fx.eventId] as never[]
    );
    const sessionId = "sess_repro_invite";

    await ballotSessionRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/ballot-session`, { sessionId }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );

    const payload = {
      sessionId,
      verificationSession: { method: "INVITATION_CODE", code: "INVITE-AAAA" },
      votes: [{ categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false }],
    };
    const first = await votesRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/votes`, payload),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    expect(first.status).toBe(200);
    expect(await persistedVotes(fx.eventId)).toHaveLength(1);

    const codes = await db.query<{ status: string; used_by: string | null }>(
      `SELECT status::text AS status, used_by_session AS used_by FROM invitation_codes WHERE code = 'INVITE-AAAA'`,
      [] as never[]
    );
    expect(codes.rows[0].status).toBe("USED");
    expect(codes.rows[0].used_by).toBeTruthy();

    // Replaying the spent code from a fresh session must fail.
    const sessionId2 = "sess_repro_invite_2";
    await ballotSessionRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/ballot-session`, { sessionId: sessionId2 }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    const second = await votesRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/votes`, {
        sessionId: sessionId2,
        verificationSession: { method: "INVITATION_CODE", code: "INVITE-AAAA" },
        votes: [{ categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false }],
      }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    expect(second.status).toBe(409);
    expect(await persistedVotes(fx.eventId)).toHaveLength(1);
  });
});

describe("submission failure and retry behaviour", () => {
  it("rejects invalid nominees, categories, payloads, and incomplete ballots", async () => {
    const fx = await seedVotingFixture(db, { verificationMethod: "NONE" });
    const sessionId = "sess_repro_invalid";
    await ballotSessionRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/ballot-session`, { sessionId }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );

    const call = (body: unknown) =>
      votesRoute.POST(jsonRequest(`/api/public/events/${fx.slug}/votes`, body), {
        params: Promise.resolve({ slug: fx.slug }),
      });

    // Invalid nominee (not in this event).
    expect(
      (
        await call({
          sessionId,
          votes: [{ categoryId: fx.categoryId, nomineeId: "00000000-0000-0000-0000-000000000001", skipped: false }],
        })
      ).status
    ).toBe(400);

    // Invalid category (not in this event).
    expect(
      (
        await call({
          sessionId,
          votes: [{ categoryId: "00000000-0000-0000-0000-000000000002", nomineeId: fx.nomineeId, skipped: false }],
        })
      ).status
    ).toBe(400);

    // Malformed payload.
    expect((await call({ sessionId, votes: "all-of-them" })).status).toBe(400);

    // Missing required category is impossible with one category, so add one.
    const extra = await db.query<{ id: string }>(
      `INSERT INTO categories (event_id, name, display_order) VALUES ($1, 'Extra', 2) RETURNING id`,
      [fx.eventId] as never[]
    );
    expect(
      (
        await call({
          sessionId,
          votes: [{ categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false }],
        })
      ).status
    ).toBe(400);

    // All-skipped ballot.
    expect(
      (
        await call({
          sessionId,
          votes: [
            { categoryId: fx.categoryId, nomineeId: null, skipped: true },
            { categoryId: extra.rows[0].id, nomineeId: null, skipped: true },
          ],
        })
      ).status
    ).toBe(400);

    // None of the failures may have persisted anything.
    expect(await persistedVotes(fx.eventId)).toHaveLength(0);
    expect((await sessionState(fx.eventId)).filter((s) => s.status === "SUBMITTED")).toHaveLength(0);
  });

  it("lets a voter retry successfully after a failed submission", async () => {
    const fx = await seedVotingFixture(db, { verificationMethod: "NONE" });
    const sessionId = "sess_repro_retry";
    await ballotSessionRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/ballot-session`, { sessionId }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );

    // First attempt fails validation (unknown nominee).
    const failed = await votesRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/votes`, {
        sessionId,
        votes: [{ categoryId: fx.categoryId, nomineeId: "00000000-0000-0000-0000-000000000009", skipped: false }],
      }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    expect(failed.status).toBe(400);

    // Retry with a valid ballot must succeed — a failed attempt does not burn
    // the voter's session or their one ballot.
    const retry = await votesRoute.POST(
      jsonRequest(`/api/public/events/${fx.slug}/votes`, {
        sessionId,
        votes: [{ categoryId: fx.categoryId, nomineeId: fx.nomineeId, skipped: false }],
      }),
      { params: Promise.resolve({ slug: fx.slug }) }
    );
    expect(retry.status).toBe(200);
    expect(await persistedVotes(fx.eventId)).toHaveLength(1);
  });

  it("rejects submissions when the voting window is closed or the event completed", async () => {
    const paused = await seedVotingFixture(db, { verificationMethod: "NONE", votingStageStatus: "PENDING" });
    await ballotSessionRoute.POST(
      jsonRequest(`/api/public/events/${paused.slug}/ballot-session`, { sessionId: "sess_repro_paused" }),
      { params: Promise.resolve({ slug: paused.slug }) }
    );
    const pausedRes = await votesRoute.POST(
      jsonRequest(`/api/public/events/${paused.slug}/votes`, {
        sessionId: "sess_repro_paused",
        votes: [{ categoryId: paused.categoryId, nomineeId: paused.nomineeId, skipped: false }],
      }),
      { params: Promise.resolve({ slug: paused.slug }) }
    );
    expect(pausedRes.status).toBe(403);

    const completed = await seedVotingFixture(db, {
      verificationMethod: "NONE",
      eventStatus: "COMPLETED",
      slug: "completed-event",
    });
    await ballotSessionRoute.POST(
      jsonRequest(`/api/public/events/${completed.slug}/ballot-session`, { sessionId: "sess_repro_done" }),
      { params: Promise.resolve({ slug: completed.slug }) }
    );
    const completedRes = await votesRoute.POST(
      jsonRequest(`/api/public/events/${completed.slug}/votes`, {
        sessionId: "sess_repro_done",
        votes: [{ categoryId: completed.categoryId, nomineeId: completed.nomineeId, skipped: false }],
      }),
      { params: Promise.resolve({ slug: completed.slug }) }
    );
    expect(completedRes.status).toBe(403);
    expect(await persistedVotes(completed.eventId)).toHaveLength(0);
  });
});
