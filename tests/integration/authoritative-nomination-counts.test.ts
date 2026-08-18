import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { createTestDb, seedVotingFixture, truncateAll, type TestDb } from "../helpers/db";
import { nominations, nominees } from "@/lib/db/schema";
import { authoritativeNominationCount } from "@/lib/nominations/counts";

describe("authoritative nomination counts", () => {
  let client: TestDb;

  beforeAll(async () => {
    client = await createTestDb();
  });

  afterEach(async () => {
    await truncateAll(client);
  });

  it("ignores a drifted nominee cache and counts latest resolved nominations", async () => {
    const fixture = await seedVotingFixture(client);
    const db = drizzle(client);

    await db.update(nominees).set({ nominationCount: 99 }).where(eq(nominees.id, fixture.nomineeId));
    await db.insert(nominations).values([
      {
        eventId: fixture.eventId,
        categoryId: fixture.categoryId,
        nomineeText: "Alice",
        resolvedNomineeId: fixture.nomineeId,
        sessionId: "current-1",
        submissionNumber: 1,
        isLatest: true,
      },
      {
        eventId: fixture.eventId,
        categoryId: fixture.categoryId,
        nomineeText: "Alice old",
        resolvedNomineeId: fixture.nomineeId,
        sessionId: "old-1",
        submissionNumber: 1,
        isLatest: false,
      },
      {
        eventId: fixture.eventId,
        categoryId: fixture.categoryId,
        nomineeText: "Unresolved",
        resolvedNomineeId: null,
        sessionId: "current-2",
        submissionNumber: 1,
        isLatest: true,
      },
    ]);

    const [result] = await db
      .select({ cached: nominees.nominationCount, authoritative: authoritativeNominationCount })
      .from(nominees)
      .where(eq(nominees.id, fixture.nomineeId));

    expect(result.cached).toBe(99);
    expect(result.authoritative).toBe(1);
  });
});
