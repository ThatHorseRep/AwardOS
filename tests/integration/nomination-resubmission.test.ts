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

async function nomineeNames(eventId: string) {
  const res = await db.query<{ name: string; status: string }>(
    `SELECT name, status::text AS status FROM nominees
     WHERE event_id = $1 ORDER BY name`,
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

describe("P2-F1: sync must ignore superseded submission versions", () => {
  it("does not create ballot nominees from superseded versions", async () => {
    const fx = await seedVotingFixture(db);
    await seedNominationsStage(fx.eventId);

    // The reported sequence: submit "Alice", then edit-resubmit to "Alicia".
    // The route syncs nominees after every commit.
    const first = await postNominations(fx.slug, "sess_phantom", fx.categoryId, "Alice");
    expect(first.status).toBe(200);
    const second = await postNominations(fx.slug, "sess_phantom", fx.categoryId, "Alicia");
    expect(second.status).toBe(200);

    // Only the name the voter's LATEST submission supports may remain on the
    // ballot roster. The superseded "Alice" version must not survive as a
    // zero-nomination ACTIVE phantom.
    const rows = await nomineeNames(fx.eventId);
    const activeNames = rows.filter((row) => row.status === "ACTIVE").map((row) => row.name);
    expect(activeNames).toEqual(["Alicia"]);

    // The retired entry is deactivated, not destroyed — it stays visible to
    // organizer cleanup with its history intact.
    const alice = rows.find((row) => row.name === "Alice");
    expect(alice?.status).toBe("REMOVED");

    const authoritative = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM nominations
       WHERE resolved_nominee_id = (SELECT id FROM nominees WHERE event_id = $1 AND status = 'ACTIVE' LIMIT 1)
         AND is_latest = true`,
      [fx.eventId] as never[]
    );
    expect(authoritative.rows[0].n).toBe(1);
  });

  it("cannot resurrect deleted nominees from superseded versions", async () => {
    const fx = await seedVotingFixture(db);
    await seedNominationsStage(fx.eventId);

    await postNominations(fx.slug, "sess_revival", fx.categoryId, "Alice");
    await postNominations(fx.slug, "sess_revival", fx.categoryId, "Alicia");

    // Mimic the organizer deleting every nominee: deleteNomineeAction releases
    // resolved_nominee_id on all versions (including superseded ones) and then
    // removes the nominee rows. A later submission triggers a fresh sync.
    await db.query(
      `UPDATE nominations SET resolved_nominee_id = NULL WHERE event_id = $1`,
      [fx.eventId] as never[]
    );
    await db.query(`DELETE FROM nominees WHERE event_id = $1`, [fx.eventId] as never[]);

    const third = await postNominations(fx.slug, "sess_other_voter", fx.categoryId, "Bob");
    expect(third.status).toBe(200);

    // The superseded "Alice" version must be gone for good. The voter's
    // LATEST "Alicia" nomination is live current intent, so sync resolving it
    // is identical semantics to a fresh nomination of that name arriving —
    // it is not a resurrection of a deleted roster decision.
    const rows = await nomineeNames(fx.eventId);
    expect(rows.map((row) => row.name)).not.toContain("Alice");
    const activeNames = rows.filter((row) => row.status === "ACTIVE").map((row) => row.name);
    expect(activeNames.sort()).toEqual(["Alicia", "Bob"]);
  });
});
