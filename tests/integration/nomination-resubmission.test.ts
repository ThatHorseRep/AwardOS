import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import {
  createTestDb,
  seedVotingFixture,
  truncateAll,
  type TestDb,
} from "../helpers/db";

/**
 * Returning-nominator versioning through the real HTTP route.
 *
 * A resubmission flips the session's previous rows to is_latest=false and
 * inserts a new set with an incremented submission_number. Two rapid
 * submissions used to interleave between the max() read and the flip,
 * leaving two latest sets for one voter and double-counting them in every
 * authoritative nomination count. The per-session advisory lock serialises
 * them; these tests pin the resulting invariants.
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

async function seedNominationsStage(eventId: string) {
  await db.query(
    `INSERT INTO workflow_stages (event_id, stage_type, display_name, status, display_order)
     VALUES ($1, 'NOMINATIONS', 'Nominations', 'ACTIVE', 0)`,
    [eventId] as never[]
  );
}

async function postNominations(
  slug: string,
  sessionId: string,
  categoryId: string,
  text: string,
) {
  const { POST } = await import(
    "@/app/api/public/events/[slug]/nominations/route"
  );
  const { NextRequest } = await import("next/server");
  const request = new NextRequest(`http://test.local/api/public/events/${slug}/nominations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nominations: [{ categoryId, nomineeText: text }],
      sessionId,
    }),
  });
  return POST(request, { params: Promise.resolve({ slug }) });
}

async function latestRows(eventId: string) {
  const res = await db.query<{
    category_id: string;
    submission_number: number;
    nominee_text: string;
  }>(
    `SELECT category_id, submission_number, nominee_text FROM nominations
     WHERE event_id = $1 AND is_latest = true ORDER BY submission_number`,
    [eventId] as never[]
  );
  return res.rows;
}

describe("nomination resubmission versioning", () => {
  it("replaces the previous latest set on resubmission", async () => {
    const fx = await seedVotingFixture(db);
    await seedNominationsStage(fx.eventId);

    const first = await postNominations(fx.slug, "sess_resub", fx.categoryId, "Alice");
    expect(first.status).toBe(200);
    const second = await postNominations(fx.slug, "sess_resub", fx.categoryId, "Alicia");
    expect(second.status).toBe(200);

    const rows = await latestRows(fx.eventId);
    // Only the newest submission stays latest.
    expect(rows).toHaveLength(1);
    expect(rows[0].nominee_text).toBe("Alicia");
    expect(rows[0].submission_number).toBe(2);
  });

  it("keeps one authoritative latest set when two submissions race", async () => {
    const fx = await seedVotingFixture(db);
    await seedNominationsStage(fx.eventId);

    const results = await Promise.allSettled([
      postNominations(fx.slug, "sess_race", fx.categoryId, "Alice"),
      postNominations(fx.slug, "sess_race", fx.categoryId, "Bob"),
    ]);
    for (const result of results) {
      expect(result.status).toBe("fulfilled");
    }

    const rows = await latestRows(fx.eventId);
    // Same-session racing submissions are resubmissions: exactly one latest
    // set survives (last write wins), versioned as submission #2.
    expect(rows).toHaveLength(1);
    expect(rows[0].submission_number).toBe(2);

    // No superseded row may still be flagged latest.
    const stale = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM nominations WHERE event_id = $1 AND is_latest = false AND submission_number = (
         SELECT max(submission_number) FROM nominations WHERE event_id = $1
       )`,
      [fx.eventId] as never[]
    );
    expect(stale.rows[0].n).toBe(0);
  });
});
