import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { createTestDb, truncateAll, seedVotingFixture, type TestDb } from "../helpers/db";

/**
 * Proves the test database is a faithful copy of the production schema. If this
 * file fails, every other integration result is meaningless.
 */
describe("test harness", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterEach(async () => {
    await truncateAll(db);
  });

  it("applies the real baseline migration", async () => {
    const res = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`
    );
    expect(res.rows[0].n).toBe(28);
  });

  it("has the tables the voting path depends on", async () => {
    const res = await db.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
    );
    const tables = res.rows.map((r) => r.tablename);
    for (const t of [
      "events",
      "categories",
      "nominees",
      "vote_sessions",
      "votes",
      "voter_otps",
      "invitation_codes",
      "workflow_stages",
    ]) {
      expect(tables).toContain(t);
    }
  });

  it("seeds a votable fixture", async () => {
    const fx = await seedVotingFixture(db);
    expect(fx.eventId).toBeTruthy();

    const res = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM nominees WHERE event_id = $1`,
      [fx.eventId]
    );
    expect(res.rows[0].n).toBe(1);
  });

  it("truncates between tests", async () => {
    const res = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM events`);
    expect(res.rows[0].n).toBe(0);
  });
});
