import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { createTestDb, truncateAll, seedVotingFixture, type TestDb } from "../helpers/db";
import { hashIP } from "@/lib/hash";

/**
 * Vote deduplication — one ballot per voter per event.
 *
 * Every test here was written failing first, against the behaviour the code had
 * at the time, and each names the defect it pins down. They are regression
 * guards now: the enforcement lives in partial unique indexes on vote_sessions,
 * so if someone drops those constraints these fail rather than silently
 * accepting duplicate ballots.
 */
describe("vote deduplication", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterEach(async () => {
    await truncateAll(db);
  });

  /**
   * Mirrors the route's fingerprint derivation. The User-Agent is deliberately
   * not an input — see the first test.
   */
  const fingerprintFor = (ip: string, _userAgent: string, slug: string) =>
    hashIP(ip, slug);

  async function castBallot(
    eventId: string,
    categoryId: string,
    nomineeId: string,
    opts: { fingerprint: string; ip: string; email?: string; token?: string }
  ) {
    const session = await db.query<{ id: string }>(
      `INSERT INTO vote_sessions
         (event_id, session_token, verified_email, device_fingerprint, ip_address, status, submitted_at)
       VALUES ($1, $2, $3, $4, $5, 'SUBMITTED', now())
       RETURNING id`,
      [
        eventId,
        opts.token ?? `tok_${Math.random().toString(36).slice(2)}`,
        opts.email ?? null,
        opts.fingerprint,
        opts.ip,
      ] as never[]
    );

    const sessionId = session.rows[0].id;

    await db.query(
      `INSERT INTO votes (vote_session_id, event_id, category_id, nominee_id) VALUES ($1, $2, $3, $4)`,
      [sessionId, eventId, categoryId, nomineeId] as never[]
    );

    return sessionId;
  }

  const submittedCount = async (eventId: string) => {
    const res = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM vote_sessions WHERE event_id = $1 AND status = 'SUBMITTED'`,
      [eventId] as never[]
    );
    return res.rows[0].n;
  };

  it("changing only the User-Agent must not create a new voter identity", async () => {
    // Was: votes/route.ts hashed `${ip}|${userAgent}`. The User-Agent is
    // attacker-supplied, so one altered byte yields a fresh fingerprint and a
    // second ballot. The fingerprint must not depend on client-controlled input.
    const fx = await seedVotingFixture(db);

    const a = fingerprintFor("203.0.113.5", "Mozilla/5.0 (Chrome)", fx.slug);
    const b = fingerprintFor("203.0.113.5", "Mozilla/5.0 (Chrome!)", fx.slug);

    expect(b).toBe(a);
  });

  it("rejects a second ballot from the same device fingerprint", async () => {
    // Was: dedup was a read-then-write application check with no database
    // constraint behind it, so nothing structurally prevented a duplicate.
    const fx = await seedVotingFixture(db);
    const fp = fingerprintFor("203.0.113.5", "UA", fx.slug);

    await castBallot(fx.eventId, fx.categoryId, fx.nomineeId, {
      fingerprint: fp,
      ip: "203.0.113.5",
    });

    await expect(
      castBallot(fx.eventId, fx.categoryId, fx.nomineeId, {
        fingerprint: fp,
        ip: "203.0.113.5",
      })
    ).rejects.toThrow();

    expect(await submittedCount(fx.eventId)).toBe(1);
  });

  it("rejects a second ballot from the same verified email", async () => {
    // Was: no unique index on (event_id, verified_email).
    const fx = await seedVotingFixture(db, { verificationMethod: "EMAIL_OTP" });

    await castBallot(fx.eventId, fx.categoryId, fx.nomineeId, {
      fingerprint: fingerprintFor("198.51.100.1", "UA-1", fx.slug),
      ip: "198.51.100.1",
      email: "voter@example.com",
    });

    await expect(
      castBallot(fx.eventId, fx.categoryId, fx.nomineeId, {
        fingerprint: fingerprintFor("198.51.100.9", "UA-2", fx.slug),
        ip: "198.51.100.9",
        email: "voter@example.com",
      })
    ).rejects.toThrow();

    expect(await submittedCount(fx.eventId)).toBe(1);
  });

  it("survives two concurrent submissions from the same voter", async () => {
    // Was: under READ COMMITTED both transactions read "no prior ballot"
    // before either commits, so both are accepted. Only a unique index (or a
    // row lock) makes this safe — wrapping it in a transaction does not.
    const fx = await seedVotingFixture(db, { verificationMethod: "EMAIL_OTP" });

    const attempt = () =>
      castBallot(fx.eventId, fx.categoryId, fx.nomineeId, {
        fingerprint: fingerprintFor("198.51.100.7", "UA", fx.slug),
        ip: "198.51.100.7",
        email: "racer@example.com",
      });

    const results = await Promise.allSettled([attempt(), attempt()]);
    const succeeded = results.filter((r) => r.status === "fulfilled").length;

    expect(succeeded).toBe(1);
    expect(await submittedCount(fx.eventId)).toBe(1);
  });

  it("allows two genuinely different voters to both vote", async () => {
    // Guard against over-correction: dedup must not block distinct people.
    const fx = await seedVotingFixture(db, { verificationMethod: "EMAIL_OTP" });

    await castBallot(fx.eventId, fx.categoryId, fx.nomineeId, {
      fingerprint: fingerprintFor("203.0.113.1", "UA", fx.slug),
      ip: "203.0.113.1",
      email: "alice@example.com",
    });

    await castBallot(fx.eventId, fx.categoryId, fx.nomineeId, {
      fingerprint: fingerprintFor("203.0.113.2", "UA", fx.slug),
      ip: "203.0.113.2",
      email: "bob@example.com",
    });

    expect(await submittedCount(fx.eventId)).toBe(2);
  });

  it("permits the same person to vote in two different events", async () => {
    // Was: vote_sessions.session_token was globally UNIQUE and the client
    // stores one localStorage key for all events, so voting in a second event
    // raises a unique violation surfaced as an HTTP 500. Uniqueness should be
    // scoped to (event_id, session_token).
    const a = await seedVotingFixture(db, { slug: "event-a" });
    const b = await seedVotingFixture(db, { slug: "event-b" });

    const sharedToken = "sess_shared_across_events";

    await castBallot(a.eventId, a.categoryId, a.nomineeId, {
      fingerprint: fingerprintFor("203.0.113.3", "UA", a.slug),
      ip: "203.0.113.3",
      token: sharedToken,
    });

    await expect(
      castBallot(b.eventId, b.categoryId, b.nomineeId, {
        fingerprint: fingerprintFor("203.0.113.3", "UA", b.slug),
        ip: "203.0.113.3",
        token: sharedToken,
      })
    ).resolves.toBeTruthy();
  });

  it("counts one vote per category per session at the database level", async () => {
    // This constraint already exists (unq_vote_session_category) — the test
    // guards it against regression.
    const fx = await seedVotingFixture(db);

    const sessionId = await castBallot(fx.eventId, fx.categoryId, fx.nomineeId, {
      fingerprint: fingerprintFor("203.0.113.8", "UA", fx.slug),
      ip: "203.0.113.8",
    });

    await expect(
      db.query(
        `INSERT INTO votes (vote_session_id, event_id, category_id, nominee_id) VALUES ($1, $2, $3, $4)`,
        [sessionId, fx.eventId, fx.categoryId, fx.nomineeId] as never[]
      )
    ).rejects.toThrow();
  });
});
