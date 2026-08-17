import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedVotingFixture, truncateAll, type TestDb } from "../helpers/db";

describe("import idempotency isolation", () => {
  let db: TestDb;
  beforeAll(async () => { db = await createTestDb(); });
  afterEach(async () => { await truncateAll(db); });

  it("rejects the same key twice for one event but permits it in another event", async () => {
    const first = await seedVotingFixture(db, { slug: "import-a" });
    const second = await seedVotingFixture(db, { slug: "import-b" });
    const key = "a".repeat(64);
    const insert = (eventId: string, userId: string) => db.query(
      `INSERT INTO import_runs (event_id, requested_by, idempotency_key) VALUES ($1, $2, $3)`,
      [eventId, userId, key] as never[],
    );

    await insert(first.eventId, first.userId);
    await expect(insert(first.eventId, first.userId)).rejects.toThrow();
    await expect(insert(second.eventId, second.userId)).resolves.toBeTruthy();
  });

  it("allows only one concurrent claim for an event and key", async () => {
    const fixture = await seedVotingFixture(db, { slug: "import-race" });
    const key = "b".repeat(64);
    const claim = () => db.query(
      `INSERT INTO import_runs (event_id, requested_by, idempotency_key) VALUES ($1, $2, $3)`,
      [fixture.eventId, fixture.userId, key] as never[],
    );
    const outcomes = await Promise.allSettled([claim(), claim()]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
  });
});
