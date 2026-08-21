import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import {
  createTestDb,
  seedVotingFixture,
  truncateAll,
  type TestDb,
} from "../helpers/db";

/**
 * P2-F3: public nomination route vs fully sanitized-empty payloads.
 *
 * A zod-valid string like "<b></b>" survives trim().min(1) but sanitizes to
 * "". The route used to skip such entries silently and then answer success,
 * acknowledging a submission that persisted nothing (and, on resubmission,
 * flipping the voter's previous valid rows out of latest). These tests pin
 * honest rejection without touching legitimate nominations that merely
 * require sanitization.
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
  entries: Array<{ categoryId: string; nomineeText: string }>,
) {
  const { POST } = await import(
    "@/app/api/public/events/[slug]/nominations/route"
  );
  const { NextRequest } = await import("next/server");
  const request = new NextRequest(`http://test.local/api/public/events/${slug}/nominations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nominations: entries, sessionId }),
  });
  return POST(request, { params: Promise.resolve({ slug }) });
}

async function nominationRows(eventId: string) {
  const res = await db.query<{
    nominee_text: string;
    is_latest: boolean;
    session_id: string;
  }>(
    `SELECT nominee_text, is_latest, session_id FROM nominations
     WHERE event_id = $1 ORDER BY session_id, submission_number`,
    [eventId] as never[]
  );
  return res.rows;
}

describe("P2-F3: route rejects payloads that persist zero nominations", () => {
  it("rejects a tag-only payload with a non-2xx status", async () => {
    const fx = await seedVotingFixture(db);
    await seedNominationsStage(fx.eventId);

    const response = await postNominations(fx.slug, "sess_empty", [
      { categoryId: fx.categoryId, nomineeText: "<b></b>" },
    ]);

    expect(response.ok).toBe(false);
    expect(response.status).toBeGreaterThanOrEqual(400);

    const rows = await nominationRows(fx.eventId);
    expect(rows).toHaveLength(0);
  });

  it("still accepts and persists a normal valid nomination", async () => {
    const fx = await seedVotingFixture(db);
    await seedNominationsStage(fx.eventId);

    const response = await postNominations(fx.slug, "sess_valid", [
      { categoryId: fx.categoryId, nomineeText: "Alice" },
    ]);

    expect(response.status).toBe(200);
    const rows = await nominationRows(fx.eventId);
    expect(rows).toHaveLength(1);
    expect(rows[0].nominee_text).toBe("Alice");
    expect(rows[0].is_latest).toBe(true);
  });

  it("keeps valid entries from a mixed payload and skips only empty ones", async () => {
    const fx = await seedVotingFixture(db);
    await seedNominationsStage(fx.eventId);

    const response = await postNominations(fx.slug, "sess_mixed", [
      { categoryId: fx.categoryId, nomineeText: "<b>Alice</b>" },
      { categoryId: fx.categoryId, nomineeText: "<b></b>" },
      { categoryId: fx.categoryId, nomineeText: "Bob" },
    ]);

    expect(response.status).toBe(200);
    const texts = (await nominationRows(fx.eventId)).map((row) => row.nominee_text);
    // The sanitized-but-real name survives; only the fully-empty entry is gone.
    expect(texts).toEqual(["Alice", "Bob"]);
  });

  it("a rejected tag-only resubmission does not wipe the previous valid set", async () => {
    const fx = await seedVotingFixture(db);
    await seedNominationsStage(fx.eventId);

    const first = await postNominations(fx.slug, "sess_wipe", [
      { categoryId: fx.categoryId, nomineeText: "Alice" },
    ]);
    expect(first.status).toBe(200);

    const second = await postNominations(fx.slug, "sess_wipe", [
      { categoryId: fx.categoryId, nomineeText: "<b></b>" },
    ]);
    expect(second.ok).toBe(false);

    // The voter's earlier submission must remain their authoritative latest set.
    const latest = await db.query<{ nominee_text: string }>(
      `SELECT nominee_text FROM nominations WHERE event_id = $1 AND is_latest = true`,
      [fx.eventId] as never[]
    );
    expect(latest.rows.map((row) => row.nominee_text)).toEqual(["Alice"]);
  });
});
