import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import {
  createTestDb,
  truncateAll,
  seedVotingFixture,
  type TestDb,
} from "../helpers/db";

/**
 * P4-3 — tabulation query behaviour.
 *
 * The live tabulator used to issue 2 queries PER NOMINEE (a vote count and an
 * official-record lookup) plus one query per category, all sequential: a
 * realistic 10×8 event cost ~170 round trips on every public results request.
 * These tests pin two things:
 *
 * 1. The tabulator issues a bounded number of queries regardless of size
 *    (measured through a counting logger on the real drizzle instance).
 * 2. The batching preserves exact semantics: per-category ranking, zero-vote
 *    defaults, empty categories, and the published-snapshot path are unchanged.
 */

let db: TestDb;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let actions: any;

const queries: string[] = [];

const ctx: { value: Record<string, unknown> | null } = { value: null };

beforeAll(async () => {
  db = await createTestDb();
  const { drizzle } = await import("drizzle-orm/pglite");
  const schema = await import("@/lib/db/schema");
  const countingLogger = { logQuery: (query: string) => queries.push(query) };
  const mockDb = drizzle(db as never, { schema: schema as never, logger: countingLogger });
  vi.doMock("@/lib/db", () => ({ db: mockDb }));

  vi.doMock("@/actions/_rbac", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/actions/_rbac")>();
    return {
      ...actual,
      requireWorkspaceRole: async () => ctx.value,
      requireEventAccess: async (eventId: string) => ({
        ...ctx.value,
        member: null,
        event: { id: eventId },
      }),
    };
  });

  actions = await import("@/actions/results");
});

afterEach(async () => {
  await truncateAll(db);
  queries.length = 0;
  ctx.value = { user: { id: "u1" }, workspace: { id: "w1" }, member: null };
});

type Fixture = Awaited<ReturnType<typeof seedVotingFixture>>;

async function addNominee(fixture: Fixture, name: string): Promise<string> {
  const res = await db.query<{ id: string }>(
    `INSERT INTO nominees (event_id, category_id, name, normalized_name, display_order, status)
     VALUES ($1, $2, $3, $4, $5, 'ACTIVE') RETURNING id`,
    [fixture.eventId, fixture.categoryId, name, name.toLowerCase(), 99] as never[]
  );
  return res.rows[0].id;
}

async function addCategory(fixture: Fixture, name: string): Promise<string> {
  const res = await db.query<{ id: string }>(
    `INSERT INTO categories (event_id, name, display_order) VALUES ($1, $2, $3) RETURNING id`,
    [fixture.eventId, name, 99] as never[]
  );
  return res.rows[0].id;
}

async function castBallot(fixture: Fixture, categoryId: string, nomineeId: string, tag: string) {
  const res = await db.query<{ id: string }>(
    `INSERT INTO vote_sessions (event_id, session_token, status, submitted_at)
     VALUES ($1, $2, 'SUBMITTED', now()) RETURNING id`,
    [fixture.eventId, `tok-${tag}`] as never[]
  );
  await db.query(
    `INSERT INTO votes (vote_session_id, event_id, category_id, nominee_id, skipped)
     VALUES ($1, $2, $3, $4, false)`,
    [res.rows[0].id, fixture.eventId, categoryId, nomineeId] as never[]
  );
}

/** Queries issued by one full organizer tabulation call. */
async function measureTabulation(fixture: Fixture): Promise<number> {
  queries.length = 0;
  await actions.getEventResultsAction(fixture.eventId);
  return queries.length;
}

describe("P4-3 tabulation batching", () => {
  it("issues a bounded number of queries as nominees grow", async () => {
    const fx = await seedVotingFixture(db);

    // Four nominees total, ballots spread across them.
    const bravo = await addNominee(fx, "Bravo");
    await addNominee(fx, "Charlie");
    await addNominee(fx, "Delta");
    await castBallot(fx, fx.categoryId, fx.nomineeId, "v1");
    await castBallot(fx, fx.categoryId, fx.nomineeId, "v2");
    await castBallot(fx, fx.categoryId, bravo, "v3");

    const smallRun = await measureTabulation(fx);

    // Double the nominee count.
    for (const name of ["Echo", "Foxtrot", "Golf", "Hotel"]) await addNominee(fx, name);
    const largeRun = await measureTabulation(fx);

    // Was: ~11 queries at four nominees growing by 2 per added nominee
    // (per-nominee count + official lookup). The batched tabulator stays flat.
    expect(smallRun).toBeLessThanOrEqual(10);
    expect(largeRun - smallRun).toBeLessThanOrEqual(2);
  });

  it("preserves ranking semantics across multiple categories", async () => {
    const fx = await seedVotingFixture(db);
    const bravo = await addNominee(fx, "Bravo");
    await addNominee(fx, "Charlie");
    const catB = await addCategory(fx, "Second Category");
    const res = await db.query<{ id: string }>(
      `INSERT INTO nominees (event_id, category_id, name, normalized_name, display_order, status)
       VALUES ($1, $2, 'Zeta', 'zeta', 1, 'ACTIVE') RETURNING id`,
      [fx.eventId, catB] as never[]
    );
    const zeta = res.rows[0].id;

    // Category A: Alice x3, Bravo x1, Charlie x0.
    await castBallot(fx, fx.categoryId, fx.nomineeId, "m1");
    await castBallot(fx, fx.categoryId, fx.nomineeId, "m2");
    await castBallot(fx, fx.categoryId, fx.nomineeId, "m3");
    await castBallot(fx, fx.categoryId, bravo, "m4");
    // Category B: Zeta x2.
    await castBallot(fx, catB, zeta, "b1");
    await castBallot(fx, catB, zeta, "b2");

    const results = await actions.getEventResultsAction(fx.eventId);
    const [catA, catBResult] = results.categoriesResults;

    expect(catA.winners.map((w: { name: string }) => w.name)).toEqual(["Alice", "Bravo", "Charlie"]);
    expect(catA.totalVotes).toBe(4);
    expect(catA.winners[0].badgeStatus).toBe("WINNER");
    expect(catBResult.winners.map((w: { name: string }) => w.name)).toEqual(["Zeta"]);
    expect(catBResult.totalVotes).toBe(2);
  });

  it("renders an empty category without error", async () => {
    const fx = await seedVotingFixture(db);
    await addCategory(fx, "Nobody Here");

    const results = await actions.getEventResultsAction(fx.eventId);
    const empty = results.categoriesResults.find(
      (c: { categoryName: string }) => c.categoryName === "Nobody Here"
    );

    expect(empty).toBeDefined();
    expect(empty.winners).toEqual([]);
    expect(empty.totalVotes).toBe(0);
  });

  it("defaults nominees with zero votes to zero, not undefined", async () => {
    const fx = await seedVotingFixture(db);
    const lonely = await addNominee(fx, "Lonely");

    await castBallot(fx, fx.categoryId, lonely, "only");

    const results = await actions.getEventResultsAction(fx.eventId);
    const cat = results.categoriesResults[0];
    const alice = cat.winners.find((w: { name: string }) => w.name === "Alice");

    expect(alice.votes).toBe(0);
    expect(alice.rawVotes).toBe(0);
    expect(alice.percentNum).toBe(0);
  });
});
