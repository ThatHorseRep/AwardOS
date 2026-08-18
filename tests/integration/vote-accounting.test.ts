import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/lib/db/schema";
import { getEventVoteAccounting } from "@/lib/voting/accounting";
import { createTestDb, seedVotingFixture, truncateAll, type TestDb } from "../helpers/db";

describe("canonical vote accounting", () => {
  let client: TestDb;

  beforeAll(async () => {
    client = await createTestDb();
  });

  afterEach(async () => {
    await truncateAll(client);
  });

  it("distinguishes ballots, selections, skips, responses, and category turnout", async () => {
    const fixture = await seedVotingFixture(client);
    const secondCategory = await client.query<{ id: string }>(
      `insert into categories (event_id, name, display_order)
       values ($1, 'Second Category', 2) returning id`,
      [fixture.eventId] as never[],
    );
    const secondNominee = await client.query<{ id: string }>(
      `insert into nominees (event_id, category_id, name, normalized_name, display_order, status)
       values ($1, $2, 'Bob', 'bob', 1, 'ACTIVE') returning id`,
      [fixture.eventId, secondCategory.rows[0].id] as never[],
    );

    const addSession = async (status: "SUBMITTED" | "IN_PROGRESS" | "INVALIDATED") => {
      const result = await client.query<{ id: string }>(
        `insert into vote_sessions (event_id, session_token, status, submitted_at)
         values ($1, gen_random_uuid()::text, $2, now())
         returning id`,
        [fixture.eventId, status] as never[],
      );
      return result.rows[0].id;
    };
    const respond = (sessionId: string, categoryId: string, nomineeId: string | null, skipped: boolean) =>
      client.query(
        `insert into votes (vote_session_id, event_id, category_id, nominee_id, skipped)
         values ($1, $2, $3, $4, $5)`,
        [sessionId, fixture.eventId, categoryId, nomineeId, skipped] as never[],
      );

    const partialSkip = await addSession("SUBMITTED");
    await respond(partialSkip, fixture.categoryId, fixture.nomineeId, false);
    await respond(partialSkip, secondCategory.rows[0].id, null, true);

    const partialResponse = await addSession("SUBMITTED");
    await respond(partialResponse, fixture.categoryId, fixture.nomineeId, false);

    const allSkipped = await addSession("SUBMITTED");
    await respond(allSkipped, fixture.categoryId, null, true);
    await respond(allSkipped, secondCategory.rows[0].id, null, true);

    for (const status of ["IN_PROGRESS", "INVALIDATED"] as const) {
      const excluded = await addSession(status);
      await respond(excluded, secondCategory.rows[0].id, secondNominee.rows[0].id, false);
    }

    const database = drizzle(client, { schema });
    const accounting = await getEventVoteAccounting(fixture.eventId, database);

    expect(accounting).toMatchObject({
      submittedBallots: 3,
      selectedVotes: 2,
      skippedResponses: 3,
      categoryResponses: 5,
    });
    expect(accounting.categories).toEqual([
      {
        categoryId: fixture.categoryId,
        categoryName: "Best Thing",
        submittedBallots: 3,
        categoryResponses: 3,
        selectedVotes: 2,
        skippedResponses: 1,
        turnoutPercent: 100,
      },
      {
        categoryId: secondCategory.rows[0].id,
        categoryName: "Second Category",
        submittedBallots: 3,
        categoryResponses: 2,
        selectedVotes: 0,
        skippedResponses: 2,
        turnoutPercent: 67,
      },
    ]);
  });

  it("returns explicit zero metrics for an event with no ballot sessions", async () => {
    const fixture = await seedVotingFixture(client, { slug: "empty-accounting" });
    const database = drizzle(client, { schema });

    await expect(getEventVoteAccounting(fixture.eventId, database)).resolves.toMatchObject({
      submittedBallots: 0,
      selectedVotes: 0,
      skippedResponses: 0,
      categoryResponses: 0,
      categories: [{ categoryResponses: 0, turnoutPercent: 0 }],
    });
  });
});
