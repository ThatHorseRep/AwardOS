import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import {
  createTestDb,
  seedVotingFixture,
  truncateAll,
  type TestDb,
} from "../helpers/db";

/**
 * Integrity ballot review mechanics (P3-F3) and the restore guard (P3-F4).
 *
 * Contract pinned here:
 * - Ballot listings order deterministically with SUBMITTED/FLAGGED/INVALIDATED
 *   ballots (which carry a submission time) ahead of IN_PROGRESS rows, whose
 *   null submittedAt must never bury real ballots under page one noise.
 * - Retrieval is paginated with total/has-more metadata and stable boundaries.
 * - Only flagged or invalidated sessions are restorable; converting an
 *   IN_PROGRESS (zero-vote) session into SUBMITTED is rejected, and a batch
 *   containing any ineligible id changes nothing.
 */

let db: TestDb;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let actions: any;

const ctx: { value: Record<string, unknown> | null } = { value: null };
const accessCalls: Array<{ eventId: string; roles: string[] }> = [];

beforeAll(async () => {
  db = await createTestDb();
  const { drizzle } = await import("drizzle-orm/pglite");
  const schema = await import("@/lib/db/schema");
  const mockDb = drizzle(db as never, { schema } as never);
  vi.doMock("@/lib/db", () => ({ db: mockDb }));

  vi.doMock("@/actions/_rbac", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/actions/_rbac")>();
    return {
      ...actual,
      requireWorkspaceRole: async (...args: unknown[]) => {
        accessCalls.push({ eventId: "workspace", roles: args[0] as string[] });
        return ctx.value;
      },
      requireEventAccess: async (eventId: string, roles?: string[]) => {
        accessCalls.push({ eventId, roles: roles ?? [] });
        return { ...ctx.value, event: { id: eventId } };
      },
    };
  });

  actions = await import("@/actions/integrity");
});

afterEach(async () => {
  await truncateAll(db);
  ctx.value = null;
  accessCalls.length = 0;
});

type Fixture = Awaited<ReturnType<typeof seedVotingFixture>>;

async function insertSession(
  fixture: Fixture,
  status: "SUBMITTED" | "IN_PROGRESS",
  opts: { minutesAgo?: number; token?: string } = {}
): Promise<string> {
  const startedAt = new Date(Date.now() - (opts.minutesAgo ?? 0) * 60_000);
  const res = await db.query<{ id: string }>(
    `INSERT INTO vote_sessions (event_id, session_token, status, submitted_at, started_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      fixture.eventId,
      opts.token ?? `tok-${Math.random()}`,
      status,
      status === "SUBMITTED" ? startedAt : null,
      startedAt,
    ] as never[]
  );
  return res.rows[0].id;
}

describe("P3-F3 ballot listing order and pagination", () => {
  it("lists submitted ballots before in-progress sessions regardless of insertion order", async () => {
    const f = await seedVotingFixture(db, { slug: "integrity-order" });

    // In-progress rows created most recently must NOT dominate the head of the
    // list just because their submitted_at is null.
    const oldAbandoned = await insertSession(f, "IN_PROGRESS", { minutesAgo: 1 });
    const olderSubmitted = await insertSession(f, "SUBMITTED", { minutesAgo: 30 });
    const recentAbandoned = await insertSession(f, "IN_PROGRESS", { minutesAgo: 2 });
    const newestSubmitted = await insertSession(f, "SUBMITTED", { minutesAgo: 5 });

    ctx.value = { user: { id: f.userId }, workspace: { id: f.workspaceId } };
    const page = await actions.getEventVoteSessionsAction(f.eventId);

    expect(page.total).toBe(4);
    expect(page.hasMore).toBe(false);
    expect(page.sessions.map((s: { id: string }) => s.id)).toEqual([
      newestSubmitted,
      olderSubmitted,
      // Deterministic tail: in-progress rows by recency of session start.
      oldAbandoned,
      recentAbandoned,
    ]);
  });

  it("paginates deterministically without duplicating or skipping records", async () => {
    const f = await seedVotingFixture(db, { slug: "integrity-pages" });

    const ids: string[] = [];
    for (let i = 0; i < 7; i++) {
      ids.push(await insertSession(f, "SUBMITTED", { minutesAgo: i + 1 }));
    }
    ids.push(await insertSession(f, "IN_PROGRESS", { minutesAgo: 20 }));

    ctx.value = { user: { id: f.userId }, workspace: { id: f.workspaceId } };

    const page1 = await actions.getEventVoteSessionsAction(f.eventId, {
      page: 1,
      pageSize: 3,
    });
    const page2 = await actions.getEventVoteSessionsAction(f.eventId, {
      page: 2,
      pageSize: 3,
    });
    const page3 = await actions.getEventVoteSessionsAction(f.eventId, {
      page: 3,
      pageSize: 3,
    });

    expect(page1).toMatchObject({ total: 8, page: 1, pageSize: 3, hasMore: true });
    expect(page2).toMatchObject({ total: 8, page: 2, hasMore: true });
    expect(page3).toMatchObject({ total: 8, page: 3, hasMore: false });
    expect(page3.sessions).toHaveLength(2);
    // Status counters are exact regardless of how much is loaded.
    expect(page1.statusCounts).toMatchObject({ SUBMITTED: 7, IN_PROGRESS: 1 });

    const seen = [
      ...page1.sessions.map((s: { id: string }) => s.id),
      ...page2.sessions.map((s: { id: string }) => s.id),
      ...page3.sessions.map((s: { id: string }) => s.id),
    ];
    expect(new Set(seen).size).toBe(8);
    // Newest submitted first; the in-progress row lands last overall.
    expect(seen.slice(0, 7)).toEqual(ids.slice(0, 7));
    expect(seen[7]).toBe(ids[7]);
  });

  it("keeps moderator-tier authorization on every retrieval", async () => {
    const f = await seedVotingFixture(db, { slug: "integrity-authz" });
    ctx.value = { user: { id: f.userId }, workspace: { id: f.workspaceId } };
    await actions.getEventVoteSessionsAction(f.eventId);
    expect(accessCalls.some((c) => c.eventId === f.eventId && c.roles.length > 0)).toBe(true);
  });
});

describe("P3-F4 restore guard", () => {
  it("restores flagged and invalidated sessions back to submitted", async () => {
    const f = await seedVotingFixture(db, { slug: "restore-ok" });
    const flagged = await insertSession(f, "SUBMITTED", { token: "flag-me" });
    const invalidated = await insertSession(f, "SUBMITTED", { token: "kill-me" });
    await db.query(`UPDATE vote_sessions SET status='FLAGGED' WHERE id=$1`, [flagged] as never[]);
    await db.query(`UPDATE vote_sessions SET status='INVALIDATED' WHERE id=$1`, [invalidated] as never[]);

    ctx.value = { user: { id: f.userId }, workspace: { id: f.workspaceId } };
    await actions.restoreSessionsAction([flagged, invalidated]);

    const statuses = await db.query<{ id: string; status: string }>(
      `SELECT id, status FROM vote_sessions WHERE event_id = $1`,
      [f.eventId] as never[]
    );
    expect(statuses.rows.every((r) => r.status === "SUBMITTED")).toBe(true);
  });

  it("refuses to promote in-progress sessions into submitted ones", async () => {
    const f = await seedVotingFixture(db, { slug: "restore-reject" });
    const inProgress = await insertSession(f, "IN_PROGRESS");

    ctx.value = { user: { id: f.userId }, workspace: { id: f.workspaceId } };
    await expect(actions.restoreSessionsAction([inProgress])).rejects.toThrow();

    const row = await db.query<{ status: string }>(
      `SELECT status FROM vote_sessions WHERE id = $1`,
      [inProgress] as never[]
    );
    expect(row.rows[0].status).toBe("IN_PROGRESS");
  });

  it("rejects a mixed batch atomically", async () => {
    const f = await seedVotingFixture(db, { slug: "restore-mixed" });
    const flagged = await insertSession(f, "SUBMITTED");
    await db.query(`UPDATE vote_sessions SET status='FLAGGED' WHERE id=$1`, [flagged] as never[]);
    const inProgress = await insertSession(f, "IN_PROGRESS");

    ctx.value = { user: { id: f.userId }, workspace: { id: f.workspaceId } };
    await expect(
      actions.restoreSessionsAction([flagged, inProgress])
    ).rejects.toThrow();

    const statuses = await db.query<{ id: string; status: string }>(
      `SELECT id, status FROM vote_sessions WHERE event_id = $1`,
      [f.eventId] as never[]
    );
    const byId = new Map(statuses.rows.map((r) => [r.id, r.status]));
    expect(byId.get(flagged)).toBe("FLAGGED");
    expect(byId.get(inProgress)).toBe("IN_PROGRESS");
  });

  it("rejects unknown session ids", async () => {
    const f = await seedVotingFixture(db, { slug: "restore-unknown" });
    ctx.value = { user: { id: f.userId }, workspace: { id: f.workspaceId } };
    await expect(
      actions.restoreSessionsAction(["00000000-0000-0000-0000-000000000000"])
    ).rejects.toThrow();
  });
});
