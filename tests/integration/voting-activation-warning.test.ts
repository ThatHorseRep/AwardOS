import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import {
  createTestDb,
  seedVotingFixture,
  truncateAll,
  type TestDb,
} from "../helpers/db";

/**
 * P3-R1: activating voting under frictionless (NONE) verification must warn
 * the organizer that identity is network-derived — one ballot per public IP —
 * before the event opens, instead of letting a shared-venue lockout be
 * discovered live. The warning is advisory: activation itself still succeeds.
 */

let db: TestDb;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let actions: any;

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
        event: { id: eventId },
      }),
    };
  });

  actions = await import("@/actions/events");
});

afterEach(async () => {
  await truncateAll(db);
  ctx.value = null;
});

async function makeVotingStageActivatable(fixture: Awaited<ReturnType<typeof seedVotingFixture>>) {
  await db.query(
    `UPDATE workflow_stages
     SET status = 'PENDING',
         starts_at = now() - interval '1 hour',
         ends_at = now() + interval '1 day'
     WHERE event_id = $1 AND stage_type = 'VOTING'`,
    [fixture.eventId] as never[]
  );

  // Mirror the action's own roster selection to compute the expected hash.
  const categories = await db.query<{
    id: string; name: string; display_order: number; max_nominees_per_voter: number | null;
  }>(
    `SELECT id, name, display_order, max_nominees_per_voter FROM categories
     WHERE event_id = $1 AND is_active = true ORDER BY display_order`,
    [fixture.eventId] as never[]
  );
  const nominees = await db.query<{
    id: string; category_id: string; name: string; display_order: number;
  }>(
    `SELECT id, category_id, name, display_order FROM nominees
     WHERE event_id = $1 AND status = 'ACTIVE' ORDER BY display_order`,
    [fixture.eventId] as never[]
  );
  const { getBallotRosterHash } = await import("@/lib/ballot-review");
  const rosterHash = getBallotRosterHash(
    categories.rows.map((c) => ({
      id: c.id,
      name: c.name,
      displayOrder: c.display_order,
      maxNomineesPerVoter: c.max_nominees_per_voter,
    })),
    nominees.rows.map((n) => ({
      id: n.id,
      categoryId: n.category_id,
      name: n.name,
      displayOrder: n.display_order,
    }))
  );
  await db.query(
    `UPDATE workflow_stages SET config = $2::jsonb
     WHERE event_id = $1 AND stage_type = 'VOTING'`,
    [
      fixture.eventId,
      JSON.stringify({ ballotReview: { rosterHash } }),
    ] as never[]
  );

  const stage = await db.query<{ id: string }>(
    `SELECT id FROM workflow_stages WHERE event_id = $1 AND stage_type = 'VOTING'`,
    [fixture.eventId] as never[]
  );
  return stage.rows[0].id;
}

describe("P3-R1 frictionless-mode activation warning", () => {
  it("warns that NONE verification means one ballot per shared network", async () => {
    const f = await seedVotingFixture(db, { slug: "warn-none", votingStageStatus: "PENDING" });
    const stageId = await makeVotingStageActivatable(f);

    ctx.value = { user: { id: f.userId }, workspace: { id: f.workspaceId } };
    const result = await actions.updateWorkflowStageStatusAction(f.eventId, stageId, "ACTIVE");

    expect(result.success).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(String(result.warnings[0])).toMatch(/one ballot per network/i);
    expect(String(result.warnings[0])).toMatch(/email codes or invitation codes/i);
  });

  it("stays silent for verified methods", async () => {
    const f = await seedVotingFixture(db, {
      slug: "warn-otp",
      votingStageStatus: "PENDING",
      verificationMethod: "EMAIL_OTP",
    });
    const stageId = await makeVotingStageActivatable(f);

    ctx.value = { user: { id: f.userId }, workspace: { id: f.workspaceId } };
    const result = await actions.updateWorkflowStageStatusAction(f.eventId, stageId, "ACTIVE");

    expect(result.success).toBe(true);
    expect(result.warnings).toEqual([]);
  });
});
