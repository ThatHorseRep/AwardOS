import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import {
  createTestDb,
  truncateAll,
  seedVotingFixture,
  type TestDb,
} from "../helpers/db";

/**
 * Raw nomination → nominee resolution (syncNomineesForEvent).
 *
 * The public nomination endpoint runs this after every submission. These tests
 * pin the invariants the ballot depends on: every source nomination resolves to
 * exactly one canonical ACTIVE nominee per category, repeated syncs are
 * idempotent, and concurrent syncs cannot create duplicate nominees.
 */

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  const { drizzle } = await import("drizzle-orm/pglite");
  const schema = await import("@/lib/db/schema");
  const mockDb = drizzle(db as never, { schema } as never);
  vi.doMock("@/lib/db", () => ({ db: mockDb }));
});

afterEach(async () => {
  await truncateAll(db);
});

async function seedNomination(
  eventId: string,
  categoryId: string,
  text: string,
) {
  await db.query(
    `INSERT INTO nominations (event_id, category_id, nominee_text, session_id)
     VALUES ($1, $2, $3, 'sess_sync_test')`,
    [eventId, categoryId, text] as never[]
  );
}

async function nomineeRows(eventId: string) {
  const res = await db.query<{
    name: string;
    normalized_name: string;
    category_id: string;
    status: string;
    nomination_count: number | null;
  }>(
    `SELECT name, normalized_name, category_id, status::text AS status, nomination_count
     FROM nominees WHERE event_id = $1 ORDER BY name`,
    [eventId] as never[]
  );
  return res.rows;
}

describe("nominee sync", () => {
  it("resolves raw nominations to one canonical nominee per normalized name", async () => {
    const fx = await seedVotingFixture(db);

    await seedNomination(fx.eventId, fx.categoryId, "Alice");
    await seedNomination(fx.eventId, fx.categoryId, "  ALICE  ");
    await seedNomination(fx.eventId, fx.categoryId, "Bob");

    const { syncNomineesForEvent } = await import("@/lib/nominations/sync");
    const result = await syncNomineesForEvent(fx.eventId);
    // The fixture already ships an ACTIVE "Alice" nominee, so both Alice
    // variants link to it and only Bob is newly created.
    expect(result.createdCount).toBe(1);
    expect(result.linkedCount).toBe(3);

    const rows = await nomineeRows(fx.eventId);
    expect(rows).toHaveLength(2);

    const alice = rows.find((r) => r.normalized_name === "alice");
    expect(alice?.status).toBe("ACTIVE");

    // Every nomination must point at its canonical nominee.
    const unresolved = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM nominations WHERE event_id = $1 AND resolved_nominee_id IS NULL`,
      [fx.eventId] as never[]
    );
    expect(unresolved.rows[0].n).toBe(0);
  });

  it("is idempotent when run again", async () => {
    const fx = await seedVotingFixture(db);
    await seedNomination(fx.eventId, fx.categoryId, "Alice");

    const { syncNomineesForEvent } = await import("@/lib/nominations/sync");
    await syncNomineesForEvent(fx.eventId);
    const second = await syncNomineesForEvent(fx.eventId);

    expect(second.createdCount).toBe(0);
    expect(second.linkedCount).toBe(0);
    expect(await nomineeRows(fx.eventId)).toHaveLength(1);

    // The cached counter must not have been inflated by the re-run.
    const rows = await nomineeRows(fx.eventId);
    expect(rows[0].nomination_count).toBe(1);
  });

  it("survives concurrent syncs without duplicating nominees", async () => {
    const fx = await seedVotingFixture(db);
    await seedNomination(fx.eventId, fx.categoryId, "Alice");
    await seedNomination(fx.eventId, fx.categoryId, "Alice");

    const { syncNomineesForEvent } = await import("@/lib/nominations/sync");
    // Two submissions landing together trigger two overlapping post-submit
    // syncs. The per-event advisory lock serialises them on real Postgres;
    // either way the outcome must be one nominee, not two.
    await Promise.all([
      syncNomineesForEvent(fx.eventId),
      syncNomineesForEvent(fx.eventId),
    ]);

    const rows = await nomineeRows(fx.eventId);
    expect(rows).toHaveLength(1);
    expect(rows[0].normalized_name).toBe("alice");

    const unresolved = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM nominations WHERE resolved_nominee_id IS NULL AND event_id = $1`,
      [fx.eventId] as never[]
    );
    expect(unresolved.rows[0].n).toBe(0);
  });

  it("matches the authoritative nomination count used by reads and exports", async () => {
    const fx = await seedVotingFixture(db);
    await seedNomination(fx.eventId, fx.categoryId, "Alice");
    await seedNomination(fx.eventId, fx.categoryId, "alice");

    const { syncNomineesForEvent } = await import("@/lib/nominations/sync");
    await syncNomineesForEvent(fx.eventId);

    // This is the exact subquery behind authoritativeNominationCount.
    const authoritative = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM nominations
       WHERE resolved_nominee_id = (SELECT id FROM nominees WHERE event_id = $1 LIMIT 1)
         AND is_latest = true`,
      [fx.eventId] as never[]
    );
    const rows = await nomineeRows(fx.eventId);
    expect(rows[0].nomination_count).toBe(authoritative.rows[0].n);
  });
});
