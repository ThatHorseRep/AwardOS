import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import {
  createTestDb,
  seedVotingFixture,
  truncateAll,
  type TestDb,
} from "../helpers/db";

/**
 * Event-creation pins for the Phase 1 remediation batch.
 *
 * P1-F2 — public slugs must be globally unique across workspaces: the public
 * URL /e/{slug} carries no workspace identity, so a duplicate live slug would
 * make the public landing/ballot/results lookups resolve nondeterministically.
 * The action must reject the collision with an operator-readable error and the
 * schema must back it with a real unique index (the race-proof guarantee).
 *
 * P1-F4 — the wizard's "Advanced OTP Verification" card advertises enforced
 * voter verification. The persisted event must therefore carry
 * verification_config.method = EMAIL_OTP; STANDARD must stay method NONE.
 *
 * P1-F5 — schedule inputs are datetime-local wall-clock strings. The stored
 * contract is UTC: the same input string must always produce the same instant
 * no matter which timezone the server happens to run in.
 */

let db: TestDb;
const ctx: {
  value: { user: { id: string }; workspace: { id: string }; member?: unknown } | null;
} = { value: null };

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

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Remediation Event",
    slug: "remediation-event",
    visibility: "UNLISTED" as const,
    categories: [{ name: "Best Thing" }],
    verificationLevel: "STANDARD" as const,
    audienceType: "PUBLIC" as const,
    ...overrides,
  };
}

async function seedSecondWorkspace(slugSuffix: string) {
  const user = await db.query<{ id: string }>(
    `INSERT INTO users (id, email, display_name)
     VALUES (gen_random_uuid(), $1, 'Other Owner') RETURNING id`,
    [`owner-${slugSuffix}@example.com`] as never[]
  );
  const workspace = await db.query<{ id: string }>(
    `INSERT INTO workspaces (name, slug, type, created_by)
     VALUES ('WS Other', $1, 'ORGANIZATION', $2) RETURNING id`,
    [`ws-other-${slugSuffix}`, user.rows[0].id] as never[]
  );
  await db.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role, status)
     VALUES ($1, $2, 'OWNER', 'ACTIVE')`,
    [workspace.rows[0].id, user.rows[0].id] as never[]
  );
  return { userId: user.rows[0].id, workspaceId: workspace.rows[0].id };
}

describe("event creation verification configuration", () => {
  it("enforces EMAIL_OTP on events created with Advanced OTP Verification", async () => {
    const fx = await seedVotingFixture(db);
    ctx.value = { user: { id: fx.userId }, workspace: { id: fx.workspaceId } };

    const { createEventAction } = await import("@/actions/events");
    const res = await createEventAction(
      baseInput({
        slug: "otp-event",
        verificationLevel: "ADVANCED",
      })
    );
    expect(res.success).toBe(true);

    const row = await db.query<{ verification_config: unknown }>(
      `SELECT verification_config FROM events WHERE id = $1`,
      [res.eventId] as never[]
    );
    expect(row.rows[0].verification_config).toEqual({ method: "EMAIL_OTP" });
  });

  it("keeps standard events on NONE so frictionless voting stays available", async () => {
    const fx = await seedVotingFixture(db);
    ctx.value = { user: { id: fx.userId }, workspace: { id: fx.workspaceId } };

    const { createEventAction } = await import("@/actions/events");
    const res = await createEventAction(baseInput({ slug: "standard-event" }));
    expect(res.success).toBe(true);

    const row = await db.query<{ verification_config: unknown }>(
      `SELECT verification_config FROM events WHERE id = $1`,
      [res.eventId] as never[]
    );
    expect(row.rows[0].verification_config).toEqual({ method: "NONE" });
  });
});

describe("public slug uniqueness across workspaces", () => {
  it("rejects creating an event whose slug another workspace already uses", async () => {
    await seedVotingFixture(db, { slug: "taken-slug" });
    const other = await seedSecondWorkspace("taken-slug");
    ctx.value = { user: { id: other.userId }, workspace: { id: other.workspaceId } };

    const { createEventAction } = await import("@/actions/events");
    await expect(
      createEventAction(baseInput({ slug: "taken-slug" }))
    ).rejects.toThrow(/slug/i);
  });

  it("backs the invariant with a database-level unique index", async () => {
    const fx = await seedVotingFixture(db, { slug: "db-unique-slug" });
    const other = await seedSecondWorkspace("db-unique-slug");

    await expect(
      db.query(
        `INSERT INTO events (workspace_id, name, slug, status, visibility, created_by)
         VALUES ($1, 'Impostor', 'db-unique-slug', 'DRAFT', 'UNLISTED', $2)`,
        [other.workspaceId, other.userId] as never[]
      )
    ).rejects.toThrow();

    // The original event is untouched by the rejected insert.
    const rows = await db.query<{ id: string }>(
      `SELECT id FROM events WHERE slug = 'db-unique-slug'`
    );
    expect(rows.rows.map((r) => r.id)).toEqual([fx.eventId]);
  });
});

describe("schedule instants are stored as UTC", () => {
  it("stores bare datetime-local schedule inputs as exact UTC instants", async () => {
    const fx = await seedVotingFixture(db);
    ctx.value = { user: { id: fx.userId }, workspace: { id: fx.workspaceId } };

    const { createEventAction } = await import("@/actions/events");
    const res = await createEventAction(
      baseInput({
        slug: "utc-windows",
        nominationStart: "2026-09-01T18:00",
        nominationEnd: "2026-09-02T18:00",
        votingStart: "2026-09-03T18:00",
        votingEnd: "2026-09-04T18:00",
      })
    );
    expect(res.success).toBe(true);

    const stages = await db.query<{
      stage_type: string;
      starts_at: Date | null;
      ends_at: Date | null;
    }>(
      `SELECT stage_type::text AS stage_type, starts_at, ends_at
       FROM workflow_stages WHERE event_id = $1 AND starts_at IS NOT NULL`,
      [res.eventId] as never[]
    );
    const byType = new Map(stages.rows.map((r) => [r.stage_type, r]));
    expect(byType.get("NOMINATIONS")?.starts_at?.toISOString()).toBe(
      "2026-09-01T18:00:00.000Z"
    );
    expect(byType.get("NOMINATIONS")?.ends_at?.toISOString()).toBe(
      "2026-09-02T18:00:00.000Z"
    );
    expect(byType.get("VOTING")?.starts_at?.toISOString()).toBe(
      "2026-09-03T18:00:00.000Z"
    );
    expect(byType.get("VOTING")?.ends_at?.toISOString()).toBe(
      "2026-09-04T18:00:00.000Z"
    );
  });

  it("honours explicit timezone offsets exactly when editing the timeline", async () => {
    const fx = await seedVotingFixture(db);
    ctx.value = { user: { id: fx.userId }, workspace: { id: fx.workspaceId } };

    const stage = await db.query<{ id: string }>(
      `SELECT id FROM workflow_stages WHERE event_id = $1 LIMIT 1`,
      [fx.eventId] as never[]
    );
    const stageId = stage.rows[0].id;

    const { updateEventTimelineAction } = await import("@/actions/events");

    // Positive offset (+05:30): 18:00 local is 12:30Z.
    await updateEventTimelineAction(fx.eventId, [
      { stageId, startsAt: "2026-07-15T18:00:00+05:30", endsAt: null },
    ]);
    let row = await db.query<{ starts_at: Date | null }>(
      `SELECT starts_at FROM workflow_stages WHERE id = $1`,
      [stageId] as never[]
    );
    expect(row.rows[0].starts_at?.toISOString()).toBe("2026-07-15T12:30:00.000Z");

    // Negative offset (-04:00, DST-active instant): 18:00 local is 22:00Z.
    await updateEventTimelineAction(fx.eventId, [
      { stageId, startsAt: "2026-01-15T18:00:00-04:00", endsAt: null },
    ]);
    row = await db.query<{ starts_at: Date | null }>(
      `SELECT starts_at FROM workflow_stages WHERE id = $1`,
      [stageId] as never[]
    );
    expect(row.rows[0].starts_at?.toISOString()).toBe("2026-01-15T22:00:00.000Z");

    // Clearing both fields stores NULLs rather than garbage dates.
    await updateEventTimelineAction(fx.eventId, [
      { stageId, startsAt: null, endsAt: null },
    ]);
    row = await db.query<{ starts_at: Date | null }>(
      `SELECT starts_at FROM workflow_stages WHERE id = $1`,
      [stageId] as never[]
    );
    expect(row.rows[0].starts_at).toBeNull();
  });
});
