import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { createTestDb, truncateAll, seedVotingFixture, type TestDb } from "../helpers/db";

/**
 * Export tallies.
 *
 * Guards the two properties an organiser relies on when they download results:
 * only submitted ballots count, and counts never bleed between events.
 */
describe("export tallies", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterEach(async () => {
    await truncateAll(db);
  });

  async function castBallot(
    fx: { eventId: string; categoryId: string; nomineeId: string },
    status: "SUBMITTED" | "IN_PROGRESS" | "INVALIDATED",
    token: string
  ) {
    const session = await db.query<{ id: string }>(
      `INSERT INTO vote_sessions (event_id, session_token, status, submitted_at)
       VALUES ($1, $2, $3, now()) RETURNING id`,
      [fx.eventId, token, status] as never[]
    );

    await db.query(
      `INSERT INTO votes (vote_session_id, event_id, category_id, nominee_id)
       VALUES ($1, $2, $3, $4)`,
      [session.rows[0].id, fx.eventId, fx.categoryId, fx.nomineeId] as never[]
    );
  }

  /** The grouped aggregate the export route runs. */
  async function tallyFor(eventId: string) {
    const res = await db.query<{ nominee_id: string; count: number }>(
      `SELECT v.nominee_id, count(v.id)::int AS count
         FROM votes v
         JOIN vote_sessions vs ON v.vote_session_id = vs.id
        WHERE v.event_id = $1 AND vs.status = 'SUBMITTED'
        GROUP BY v.nominee_id`,
      [eventId] as never[]
    );
    return new Map(res.rows.map((r) => [r.nominee_id, r.count]));
  }

  it("counts only submitted ballots", async () => {
    const fx = await seedVotingFixture(db);

    await castBallot(fx, "SUBMITTED", "t1");
    await castBallot(fx, "IN_PROGRESS", "t2");
    await castBallot(fx, "INVALIDATED", "t3");

    const tally = await tallyFor(fx.eventId);
    expect(tally.get(fx.nomineeId)).toBe(1);
  });

  it("does not count another event's ballots", async () => {
    // The per-nominee COUNT this replaced matched on nomineeId alone, with no
    // event predicate — so a nominee present in two events had both events'
    // ballots folded into each export.
    const a = await seedVotingFixture(db, { slug: "tally-a" });
    const b = await seedVotingFixture(db, { slug: "tally-b" });

    await castBallot(a, "SUBMITTED", "a1");
    await castBallot(b, "SUBMITTED", "b1");
    await castBallot(b, "SUBMITTED", "b2");

    expect((await tallyFor(a.eventId)).get(a.nomineeId)).toBe(1);
    expect((await tallyFor(b.eventId)).get(b.nomineeId)).toBe(2);
  });

  it("reports nothing for an event with no ballots", async () => {
    const fx = await seedVotingFixture(db);
    expect((await tallyFor(fx.eventId)).size).toBe(0);
  });
});
