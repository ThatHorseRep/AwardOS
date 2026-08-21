import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import {
  createTestDb,
  seedVotingFixture,
  truncateAll,
  type TestDb,
} from "../helpers/db";

/**
 * Workflow-stage activation invariants through the real action.
 *
 * Activation is defined to be one-stage-active-at-a-time: activating a stage
 * completes every earlier ACTIVE stage. Two admins transitioning different
 * stages near-simultaneously used to interleave under READ COMMITTED (neither
 * saw the other's uncommitted row) and commit two ACTIVE stages. A per-event
 * advisory lock serialises transitions; these tests pin both the cascade
 * behaviour and the concurrency invariant.
 */

let db: TestDb;
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
});

afterEach(async () => {
  await truncateAll(db);
  ctx.value = null;
});

async function seedStages(eventId: string) {
  // Normalise the fixture's VOTING stage so stage state is fully determined
  // by these tests, then add non-VOTING neighbours (activation paths avoid
  // ballot-preview gating entirely).
  await db.query(
    `UPDATE workflow_stages SET status = 'PENDING' WHERE event_id = $1`,
    [eventId] as never[]
  );
  const nominations = await db.query<{ id: string }>(
    `INSERT INTO workflow_stages (event_id, stage_type, display_name, status, display_order)
     VALUES ($1, 'NOMINATIONS', 'Nominations', 'PENDING', 0) RETURNING id`,
    [eventId] as never[]
  );
  const screening = await db.query<{ id: string }>(
    `INSERT INTO workflow_stages (event_id, stage_type, display_name, status, display_order)
     VALUES ($1, 'SCREENING', 'Screening', 'PENDING', 2) RETURNING id`,
    [eventId] as never[]
  );
  return { nominationsId: nominations.rows[0].id, screeningId: screening.rows[0].id };
}

async function activeStages(eventId: string) {
  const res = await db.query<{ id: string }>(
    `SELECT id FROM workflow_stages WHERE event_id = $1 AND status = 'ACTIVE'`,
    [eventId] as never[]
  );
  return res.rows.map((r) => r.id);
}

describe("workflow stage transitions", () => {
  it("completes the earlier active stage when a later one activates", async () => {
    const fx = await seedVotingFixture(db);
    ctx.value = {
      user: { id: fx.userId },
      workspace: { id: fx.workspaceId },
      member: {},
    };
    const { nominationsId, screeningId } = await seedStages(fx.eventId);

    const { updateWorkflowStageStatusAction } = await import("@/actions/events");
    await updateWorkflowStageStatusAction(fx.eventId, nominationsId, "ACTIVE");
    expect(await activeStages(fx.eventId)).toEqual([nominationsId]);

    await updateWorkflowStageStatusAction(fx.eventId, screeningId, "ACTIVE");
    const active = await activeStages(fx.eventId);
    expect(active).toEqual([screeningId]);

    const nominationsStatus = await db.query<{ status: string }>(
      `SELECT status::text AS status FROM workflow_stages WHERE id = $1`,
      [nominationsId] as never[]
    );
    expect(nominationsStatus.rows[0].status).toBe("COMPLETED");
  });

  it("leaves exactly one ACTIVE stage when two activations race", async () => {
    const fx = await seedVotingFixture(db);
    ctx.value = {
      user: { id: fx.userId },
      workspace: { id: fx.workspaceId },
      member: {},
    };
    const { nominationsId, screeningId } = await seedStages(fx.eventId);

    const { updateWorkflowStageStatusAction } = await import("@/actions/events");
    const outcomes = await Promise.allSettled([
      updateWorkflowStageStatusAction(fx.eventId, nominationsId, "ACTIVE"),
      updateWorkflowStageStatusAction(fx.eventId, screeningId, "ACTIVE"),
    ]);

    // Both orders are legal now that backward reactivation is guarded: either
    // both transitions commit in forward order, or nominations loses the race
    // to the reactivation guard and is rejected. What may never happen is two
    // ACTIVE stages or a rejected forward transition.
    for (const outcome of outcomes) {
      if (outcome.status === "rejected") {
        expect(String(outcome.reason)).toMatch(/no longer be reopened|later stage/i);
      }
    }

    // The product invariant: never two ACTIVE stages at once. On real
    // Postgres the per-event lock guarantees the later committer cascades the
    // earlier one to COMPLETED.
    const active = await activeStages(fx.eventId);
    expect(active).toEqual([screeningId]);
  });

  it("rejects reactivating a completed stage", async () => {
    const fx = await seedVotingFixture(db);
    ctx.value = {
      user: { id: fx.userId },
      workspace: { id: fx.workspaceId },
      member: {},
    };
    const { nominationsId } = await seedStages(fx.eventId);

    const { updateWorkflowStageStatusAction } = await import("@/actions/events");
    await updateWorkflowStageStatusAction(fx.eventId, nominationsId, "ACTIVE");
    await updateWorkflowStageStatusAction(fx.eventId, nominationsId, "COMPLETED");

    await expect(
      updateWorkflowStageStatusAction(fx.eventId, nominationsId, "ACTIVE")
    ).rejects.toThrow(/no longer be reopened|later stage/i);

    const statuses = await db.query<{ status: string }>(
      `SELECT status::text AS status FROM workflow_stages WHERE event_id = $1`,
      [fx.eventId] as never[]
    );
    expect(statuses.rows.map((r) => r.status)).not.toContain("ACTIVE");
  });

  it("rejects activating an earlier stage while a later one is active", async () => {
    const fx = await seedVotingFixture(db);
    ctx.value = {
      user: { id: fx.userId },
      workspace: { id: fx.workspaceId },
      member: {},
    };
    const { nominationsId, screeningId } = await seedStages(fx.eventId);

    const { updateWorkflowStageStatusAction } = await import("@/actions/events");
    await updateWorkflowStageStatusAction(fx.eventId, screeningId, "ACTIVE");

    await expect(
      updateWorkflowStageStatusAction(fx.eventId, nominationsId, "ACTIVE")
    ).rejects.toThrow(/no longer be reopened|later stage/i);

    expect(await activeStages(fx.eventId)).toEqual([screeningId]);
  });

  it("only lets the currently active stage be marked completed", async () => {
    const fx = await seedVotingFixture(db);
    ctx.value = {
      user: { id: fx.userId },
      workspace: { id: fx.workspaceId },
      member: {},
    };
    const { nominationsId, screeningId } = await seedStages(fx.eventId);

    const { updateWorkflowStageStatusAction } = await import("@/actions/events");

    await expect(
      updateWorkflowStageStatusAction(fx.eventId, nominationsId, "COMPLETED")
    ).rejects.toThrow(/currently active/i);

    await updateWorkflowStageStatusAction(fx.eventId, screeningId, "ACTIVE");
    await updateWorkflowStageStatusAction(fx.eventId, screeningId, "COMPLETED");

    const row = await db.query<{ status: string }>(
      `SELECT status::text AS status FROM workflow_stages WHERE id = $1`,
      [screeningId] as never[]
    );
    expect(row.rows[0].status).toBe("COMPLETED");
  });

  it("rejects unsupported target statuses outright", async () => {
    const fx = await seedVotingFixture(db);
    ctx.value = {
      user: { id: fx.userId },
      workspace: { id: fx.workspaceId },
      member: {},
    };
    const { nominationsId } = await seedStages(fx.eventId);

    const { updateWorkflowStageStatusAction } = await import("@/actions/events");
    for (const unsupported of ["PENDING", "SKIPPED"] as const) {
      await expect(
        updateWorkflowStageStatusAction(fx.eventId, nominationsId, unsupported)
      ).rejects.toThrow(/unsupported/i);
    }
  });

  it("propagates authorization failures before touching any stage", async () => {
    const fx = await seedVotingFixture(db);
    // No authenticated context at all: requireEventAccess must reject.
    ctx.value = null;

    const { nominationsId } = await seedStages(fx.eventId);
    const { updateWorkflowStageStatusAction } = await import("@/actions/events");
    await expect(
      updateWorkflowStageStatusAction(fx.eventId, nominationsId, "ACTIVE")
    ).rejects.toThrow();

    const active = await activeStages(fx.eventId);
    expect(active).toEqual([]);
  });
});
