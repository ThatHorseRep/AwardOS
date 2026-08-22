import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import {
  createTestDb,
  truncateAll,
  seedVotingFixture,
  type TestDb,
} from "../helpers/db";

/**
 * P4-5 — ballot-settings concurrency semantics.
 *
 * updateBallotSettingsAction performs a PARTIAL update: only supplied fields
 * are written. Concurrent organizer edits to different settings therefore do
 * not clobber each other; concurrent edits to the same enum field are last-
 * write-wins by design — there is no meaningful merge of two organizers'
 * conflicting choices for a single enum, and the settings surface is scoped
 * to workspace admins.
 *
 * One residual is documented rather than fixed: the "method locked after
 * first ballot" check reads submitted-ballot existence outside a transaction,
 * so a ballot committing inside that read-write window can land under a
 * freshly switched method. The window is milliseconds wide against an
 * election-length decision, dedup indexes are unaffected, and closing it
 * would couple the voting hot path to a settings row lock. Accepted residual.
 *
 * These tests pin the contract so a future refactor cannot quietly turn the
 * partial update into a whole-object overwrite.
 */

let db: TestDb;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let eventsActions: any;

const ctx: { value: Record<string, unknown> | null } = { value: null };

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
      requireWorkspaceRole: async () => ctx.value,
      requireEventAccess: async (eventId: string) => ({
        ...ctx.value,
        member: null,
        event: { id: eventId },
      }),
    };
  });

  eventsActions = await import("@/actions/events");
});

beforeEach(() => {
  ctx.value = { user: { id: "u1" }, workspace: { id: "w1" }, member: null };
});

afterEach(async () => {
  await truncateAll(db);
});

async function eventRow(eventId: string) {
  const res = await db.query<{
    visibility: string;
    live_results_mode: string;
    verification_config: unknown;
  }>(
    `SELECT visibility::text AS visibility, live_results_mode::text AS live_results_mode, verification_config
     FROM events WHERE id = $1`,
    [eventId] as never[]
  );
  return res.rows[0];
}

describe("P4-5 ballot settings semantics", () => {
  it("partial updates leave unspecified fields untouched", async () => {
    const fx = await seedVotingFixture(db);
    ctx.value = { user: { id: "u1" }, workspace: { id: fx.workspaceId }, member: null };
    await db.query(
      `UPDATE events SET verification_config = '{"method":"EMAIL_OTP"}'::jsonb WHERE id = $1`,
      [fx.eventId] as never[]
    );

    await eventsActions.updateBallotSettingsAction({
      eventId: fx.eventId,
      visibility: "UNLISTED",
    });

    const row = await eventRow(fx.eventId);
    expect(row.visibility).toBe("UNLISTED");
    // The verification config must survive an unrelated field's update.
    expect(row.verification_config).toEqual({ method: "EMAIL_OTP" });
  });

  it("keeps last-write-wins for repeated edits to the same field", async () => {
    const fx = await seedVotingFixture(db);
    ctx.value = { user: { id: "u1" }, workspace: { id: fx.workspaceId }, member: null };

    await eventsActions.updateBallotSettingsAction({
      eventId: fx.eventId,
      liveResultsMode: "PERCENTAGES",
    });
    await eventsActions.updateBallotSettingsAction({
      eventId: fx.eventId,
      liveResultsMode: "HIDDEN",
    });

    expect((await eventRow(fx.eventId)).live_results_mode).toBe("HIDDEN");
  });

  it("allows changing the verification method before any ballot exists", async () => {
    const fx = await seedVotingFixture(db);
    ctx.value = { user: { id: "u1" }, workspace: { id: fx.workspaceId }, member: null };

    const result = await eventsActions.updateBallotSettingsAction({
      eventId: fx.eventId,
      verificationMethod: "INVITATION_CODE",
    });
    expect(result.success).toBe(true);
    expect((await eventRow(fx.eventId)).verification_config).toEqual({
      method: "INVITATION_CODE",
    });
  });

  it("locks the verification method after the first submitted ballot", async () => {
    const fx = await seedVotingFixture(db);
    ctx.value = { user: { id: "u1" }, workspace: { id: fx.workspaceId }, member: null };
    await db.query(
      `INSERT INTO vote_sessions (event_id, session_token, status, submitted_at)
       VALUES ($1, 'tok-lock', 'SUBMITTED', now())`,
      [fx.eventId] as never[]
    );

    await expect(
      eventsActions.updateBallotSettingsAction({
        eventId: fx.eventId,
        verificationMethod: "EMAIL_OTP",
      })
    ).rejects.toThrow(/locked after the first ballot/i);

    // Rejected write must not have mutated anything.
    expect((await eventRow(fx.eventId)).verification_config).toEqual({
      method: "NONE",
    });
  });
});
