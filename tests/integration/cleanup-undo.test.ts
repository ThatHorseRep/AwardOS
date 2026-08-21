import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import {
  createTestDb,
  seedVotingFixture,
  truncateAll,
  type TestDb,
} from "../helpers/db";

/**
 * AI merge suggestion approval + undo.
 *
 * Approving a suggestion with an organizer-typed custom name never persists
 * that name on the suggestion row. The undo path used to relocate the merge
 * target by suggestedName only, so undoing a custom-named approval silently
 * kept every nomination link while reporting the merge as undone. These tests
 * pin the link-derived target resolution for both naming paths.
 */

let db: TestDb;

// The RBAC seam is mocked so the real action code runs against the fixture;
// the holder is refreshed by each test after seeding.
const ctx: { value: Record<string, unknown> | null } = { value: null };

beforeAll(async () => {
  db = await createTestDb();
  const { drizzle: drizzlePg } = await import("drizzle-orm/pglite");
  const schema = await import("@/lib/db/schema");
  const mockDb = drizzlePg(db as never, { schema } as never);
  vi.doMock("@/lib/db", () => ({ db: mockDb }));

  vi.doMock("@/lib/rate-limit", () => ({
    consumeRateLimit: async () => ({ success: true }),
  }));

  vi.doMock("@/actions/_rbac", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/actions/_rbac")>();
    return {
      ...actual,
      requireWorkspaceRole: async () => ctx.value,
      requireEventAccess: async (eventId: string) => ({
        ...ctx.value,
        event: { id: eventId },
      }),
    };
  });

  // Heavy AI pipeline is irrelevant to these paths; keep module import light.
  vi.doMock("@/lib/ai/cleanup", () => ({
    batchCleanupItems: [],
    runAINominationCleanup: async () => ({
      cleanedItems: [],
      mergeSuggestions: [],
      blankRemovedCount: 0,
      normalizedCount: 0,
    }),
  }));
});

afterEach(async () => {
  await truncateAll(db);
  ctx.value = null;
});

async function seedSuggestion(
  fx: Awaited<ReturnType<typeof seedVotingFixture>>,
  sourceNames: string[],
  suggestedName: string,
) {
  const task = await db.query<{ id: string }>(
    `INSERT INTO ai_cleanup_tasks (event_id, triggered_by, status)
     VALUES ($1, $2, 'COMPLETED') RETURNING id`,
    [fx.eventId, fx.userId] as never[]
  );
  const sug = await db.query<{ id: string }>(
    `INSERT INTO ai_merge_suggestions
       (cleanup_task_id, event_id, category_id, source_nominees, suggested_name, confidence, confidence_tier, match_reason)
     VALUES ($1, $2, $3, $4::jsonb, $5, 0.9, 'HIGH', 'test fixture') RETURNING id`,
    [
      task.rows[0].id,
      fx.eventId,
      fx.categoryId,
      JSON.stringify(sourceNames),
      suggestedName,
    ] as never[]
  );
  return sug.rows[0].id;
}

async function insertNomination(
  fx: Awaited<ReturnType<typeof seedVotingFixture>>,
  text: string,
  sessionId: string,
) {
  await db.query(
    `INSERT INTO nominations (event_id, category_id, nominee_text, session_id)
     VALUES ($1, $2, $3, $4)`,
    [fx.eventId, fx.categoryId, text, sessionId] as never[]
  );
}

async function insertVersionedNomination(
  fx: Awaited<ReturnType<typeof seedVotingFixture>>,
  text: string,
  sessionId: string,
  submissionNumber: number,
  isLatest: boolean,
) {
  await db.query(
    `INSERT INTO nominations (event_id, category_id, nominee_text, session_id, submission_number, is_latest)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [fx.eventId, fx.categoryId, text, sessionId, submissionNumber, isLatest] as never[]
  );
}

describe("merge suggestion approve/undo", () => {
  it("undo reverts a custom-named approval even though the name was not stored", async () => {
    const fx = await seedVotingFixture(db);
    ctx.value = {
      user: { id: fx.userId },
      workspace: { id: fx.workspaceId },
      member: {},
    };

    await insertNomination(fx, "Kanye West", "s1");
    await insertNomination(fx, "Kanye West", "s2");
    await insertNomination(fx, "kanye west", "s3");
    const suggestionId = await seedSuggestion(fx, ["Kanye West", "kanye west"], "Kanye");

    const { approveMergeSuggestionAction, undoMergeSuggestionAction } =
      await import("@/actions/cleanup");

    await approveMergeSuggestionAction(suggestionId, "Ye");

    const linkedBefore = await db.query<{ n: number; target: string | null }>(
      `SELECT count(*)::int AS n, min(resolved_nominee_id::text) AS target
       FROM nominations WHERE nominee_text ILIKE 'kanye%'`,
      [] as never[]
    );
    expect(linkedBefore.rows[0].n).toBe(3);
    const yeTarget = linkedBefore.rows[0].target;
    expect(yeTarget).not.toBeNull();

    // Sanity: the applied name really does differ from suggestedName.
    const nominee = await db.query<{ normalized_name: string }>(
      `SELECT normalized_name FROM nominees WHERE id = $1`,
      [yeTarget] as never[]
    );
    expect(nominee.rows[0].normalized_name).toBe("ye");

    await undoMergeSuggestionAction(suggestionId);

    const linkedAfter = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM nominations
       WHERE nominee_text ILIKE 'kanye%' AND resolved_nominee_id IS NOT NULL`,
      [] as never[]
    );
    expect(linkedAfter.rows[0].n).toBe(0);

    // Counter recomputed against the reverted links.
    const count = await db.query<{ nomination_count: number }>(
      `SELECT nomination_count FROM nominees WHERE id = $1`,
      [yeTarget] as never[]
    );
    expect(count.rows[0].nomination_count).toBe(0);

    const status = await db.query<{ status: string }>(
      `SELECT status::text AS status FROM ai_merge_suggestions WHERE id = $1`,
      [suggestionId] as never[]
    );
    expect(status.rows[0].status).toBe("PENDING");
  });

  it("undo still works when the approval used the suggested name", async () => {
    const fx = await seedVotingFixture(db);
    ctx.value = {
      user: { id: fx.userId },
      workspace: { id: fx.workspaceId },
      member: {},
    };

    await insertNomination(fx, "Ye", "s1");
    const suggestionId = await seedSuggestion(fx, ["Ye"], "Ye");

    const { approveMergeSuggestionAction, undoMergeSuggestionAction } =
      await import("@/actions/cleanup");
    await approveMergeSuggestionAction(suggestionId);

    const before = await db.query<{ target: string | null }>(
      `SELECT resolved_nominee_id::text AS target FROM nominations WHERE nominee_text = 'Ye'`,
      [] as never[]
    );
    expect(before.rows[0].target).not.toBeNull();

    await undoMergeSuggestionAction(suggestionId);

    const after = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM nominations
       WHERE nominee_text = 'Ye' AND resolved_nominee_id IS NOT NULL`,
      [] as never[]
    );
    expect(after.rows[0].n).toBe(0);
  });

  it("undo recovers the merge target after a bulk approval", async () => {
    const fx = await seedVotingFixture(db);
    ctx.value = {
      user: { id: fx.userId },
      workspace: { id: fx.workspaceId },
      member: {},
    };

    await insertNomination(fx, "Batch Guy", "s1");
    const suggestionId = await seedSuggestion(fx, ["Batch Guy"], "Batch Guy");

    const { bulkApproveMergeSuggestionsAction, undoMergeSuggestionAction } =
      await import("@/actions/cleanup");
    await bulkApproveMergeSuggestionsAction([suggestionId]);

    const before = await db.query<{ target: string | null }>(
      `SELECT resolved_nominee_id::text AS target FROM nominations WHERE nominee_text = 'Batch Guy'`,
      [] as never[]
    );
    expect(before.rows[0].target).not.toBeNull();

    await undoMergeSuggestionAction(suggestionId);

    const after = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM nominations
       WHERE nominee_text = 'Batch Guy' AND resolved_nominee_id IS NOT NULL`,
      [] as never[]
    );
    expect(after.rows[0].n).toBe(0);
  });

  it("concurrent approvals of one suggestion resolve a single nominee", async () => {
    const fx = await seedVotingFixture(db);
    ctx.value = {
      user: { id: fx.userId },
      workspace: { id: fx.workspaceId },
      member: {},
    };

    await insertNomination(fx, "Race Person", "s1");
    const suggestionId = await seedSuggestion(fx, ["Race Person"], "Race Person");

    const { approveMergeSuggestionAction } = await import("@/actions/cleanup");
    const outcomes = await Promise.allSettled([
      approveMergeSuggestionAction(suggestionId),
      approveMergeSuggestionAction(suggestionId),
    ]);
    // One applies, the other either reports already-applied or waits and sees
    // APPROVED — neither may create a second nominee.
    expect(outcomes.some((o) => o.status === "fulfilled")).toBe(true);

    const nomineesForText = await db.query<{ n: number }>(
      `SELECT count(DISTINCT n.id)::int AS n FROM nominees n
       WHERE n.event_id = $1 AND n.category_id = $2 AND n.normalized_name = 'race person'`,
      [fx.eventId, fx.categoryId] as never[]
    );
    expect(nomineesForText.rows[0].n).toBe(1);

    const links = await db.query<{ target: string | null }>(
      `SELECT resolved_nominee_id::text AS target FROM nominations WHERE nominee_text = 'Race Person'`,
      [] as never[]
    );
    expect(links.rows[0].target).not.toBeNull();
  });

  it("undo does not steal links a later merge took over", async () => {
    const fx = await seedVotingFixture(db);
    ctx.value = {
      user: { id: fx.userId },
      workspace: { id: fx.workspaceId },
      member: {},
    };

    await insertNomination(fx, "Alice A", "s1");
    const firstId = await seedSuggestion(fx, ["Alice A"], "Alice Combined");

    const cleanup = await import("@/actions/cleanup");
    await cleanup.approveMergeSuggestionAction(firstId);

    // A later, separate decision re-points the same raw text elsewhere.
    const second = await db.query<{ id: string }>(
      `INSERT INTO nominees (event_id, category_id, name, normalized_name, display_order, status)
       VALUES ($1, $2, 'Other', 'other', 9, 'ACTIVE') RETURNING id`,
      [fx.eventId, fx.categoryId] as never[]
    );
    await db.query(
      `UPDATE nominations SET resolved_nominee_id = $1 WHERE nominee_text = 'Alice A'`,
      [second.rows[0].id] as never[]
    );

    await cleanup.undoMergeSuggestionAction(firstId);

    // The link now owned by the later nominee must survive the undo.
    const owner = await db.query<{ target: string | null }>(
      `SELECT resolved_nominee_id::text AS target FROM nominations WHERE nominee_text = 'Alice A'`,
      [] as never[]
    );
    expect(owner.rows[0].target).toBe(second.rows[0].id);
  });
});

describe("P2-F2: single and bulk approvals share latest-version semantics", () => {
  async function seedVersionedFixture() {
    const fx = await seedVotingFixture(db);
    ctx.value = {
      user: { id: fx.userId },
      workspace: { id: fx.workspaceId },
      member: {},
    };

    // One voter resubmitted the same name: v1 superseded, v2 authoritative.
    await insertVersionedNomination(fx, "Jane Doe", "s1", 1, false);
    await insertVersionedNomination(fx, "Jane Doe", "s1", 2, true);
    const suggestionId = await seedSuggestion(fx, ["Jane Doe"], "Jane Doe");
    return { fx, suggestionId };
  }

  async function linkedVersions() {
    const res = await db.query<{ n: number; latest_linked: number }>(
      `SELECT count(*)::int AS n,
              count(*) FILTER (WHERE is_latest)::int AS latest_linked
       FROM nominations WHERE resolved_nominee_id IS NOT NULL`,
      [] as never[]
    );
    return res.rows[0];
  }

  it("single approval links only the authoritative latest version", async () => {
    const { fx, suggestionId } = await seedVersionedFixture();

    const { approveMergeSuggestionAction } = await import("@/actions/cleanup");
    await approveMergeSuggestionAction(suggestionId);

    const links = await linkedVersions();
    // Exactly one row may be linked, and it must be the latest one.
    expect(links.n).toBe(1);
    expect(links.latest_linked).toBe(1);

    // The cached counter is recomputed authoritatively inside the action.
    const cached = await db.query<{ nomination_count: number }>(
      `SELECT nomination_count FROM nominees
       WHERE event_id = $1 AND normalized_name = 'jane doe'`,
      [fx.eventId] as never[]
    );
    expect(cached.rows[0].nomination_count).toBe(1);
  });

  it("bulk approval produces identical link behavior on the same fixture", async () => {
    const { suggestionId } = await seedVersionedFixture();

    const { bulkApproveMergeSuggestionsAction } = await import("@/actions/cleanup");
    await bulkApproveMergeSuggestionsAction([suggestionId]);

    const links = await linkedVersions();
    expect(links.n).toBe(1);
    expect(links.latest_linked).toBe(1);
  });
});
