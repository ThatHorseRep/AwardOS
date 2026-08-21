import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import {
  createTestDb,
  seedVotingFixture,
  truncateAll,
  type TestDb,
} from "../helpers/db";

/**
 * P1-F3 — voter verification configuration is authoritative in
 * `events.verification_config.method`. These pins hold the server side of the
 * contract that the ballot-settings UI must respect:
 *
 *   - saving unrelated settings must never touch the stored method,
 *   - an explicitly chosen method change persists exactly as chosen,
 *   - NONE / EMAIL_OTP / INVITATION_CODE round-trip verbatim,
 *   - the after-first-ballot lock still guards method changes.
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
    };
  });
});

afterEach(async () => {
  await truncateAll(db);
  ctx.value = null;
});

async function storedMethod(eventId: string): Promise<unknown> {
  const row = await db.query<{ verification_config: unknown }>(
    `SELECT verification_config FROM events WHERE id = $1`,
    [eventId] as never[]
  );
  return (row.rows[0].verification_config as { method?: string } | null)?.method;
}

describe("ballot settings preserve the authoritative verification method", () => {
  it("NONE remains NONE when unrelated settings are saved", async () => {
    const fx = await seedVotingFixture(db, { verificationMethod: "NONE" });
    ctx.value = { user: { id: fx.userId }, workspace: { id: fx.workspaceId } };

    const { updateBallotSettingsAction } = await import("@/actions/events");
    const res = await updateBallotSettingsAction({
      eventId: fx.eventId,
      visibility: "PRIVATE",
      liveResultsMode: "HIDDEN",
    });
    expect(res.success).toBe(true);
    expect(await storedMethod(fx.eventId)).toBe("NONE");
  });

  it("EMAIL_OTP stays EMAIL_OTP when unrelated settings are saved", async () => {
    const fx = await seedVotingFixture(db, { verificationMethod: "EMAIL_OTP" });
    ctx.value = { user: { id: fx.userId }, workspace: { id: fx.workspaceId } };

    const { updateBallotSettingsAction } = await import("@/actions/events");
    await updateBallotSettingsAction({
      eventId: fx.eventId,
      visibility: "PUBLIC",
    });
    expect(await storedMethod(fx.eventId)).toBe("EMAIL_OTP");
  });

  it("INVITATION_CODE stays INVITATION_CODE when re-saved unchanged", async () => {
    const fx = await seedVotingFixture(db, { verificationMethod: "INVITATION_CODE" });
    ctx.value = { user: { id: fx.userId }, workspace: { id: fx.workspaceId } };

    const { updateBallotSettingsAction } = await import("@/actions/events");
    await updateBallotSettingsAction({
      eventId: fx.eventId,
      verificationMethod: "INVITATION_CODE",
    });
    expect(await storedMethod(fx.eventId)).toBe("INVITATION_CODE");
  });

  it("an explicitly chosen method change persists intentionally", async () => {
    const fx = await seedVotingFixture(db, { verificationMethod: "NONE" });
    ctx.value = { user: { id: fx.userId }, workspace: { id: fx.workspaceId } };

    const { updateBallotSettingsAction } = await import("@/actions/events");
    await updateBallotSettingsAction({
      eventId: fx.eventId,
      verificationMethod: "EMAIL_OTP",
    });
    expect(await storedMethod(fx.eventId)).toBe("EMAIL_OTP");
  });

  it("still locks method changes once a ballot has been submitted", async () => {
    const fx = await seedVotingFixture(db, { verificationMethod: "NONE" });
    ctx.value = { user: { id: fx.userId }, workspace: { id: fx.workspaceId } };

    await db.query(
      `INSERT INTO vote_sessions (event_id, session_token, status)
       VALUES ($1, 'tok-locked', 'SUBMITTED')`,
      [fx.eventId] as never[]
    );

    const { updateBallotSettingsAction } = await import("@/actions/events");
    await expect(
      updateBallotSettingsAction({
        eventId: fx.eventId,
        verificationMethod: "EMAIL_OTP",
      })
    ).rejects.toThrow(/locked/i);
    expect(await storedMethod(fx.eventId)).toBe("NONE");
  });

  it("derives the displayed default purely from stored configuration", async () => {
    const { storedVerificationMethod } = await import("@/lib/voting/settings");
    expect(storedVerificationMethod(undefined)).toBe("NONE");
    expect(storedVerificationMethod(null)).toBe("NONE");
    expect(storedVerificationMethod({})).toBe("NONE");
    expect(storedVerificationMethod({ method: "NONE" })).toBe("NONE");
    expect(storedVerificationMethod({ method: "EMAIL_OTP" })).toBe("EMAIL_OTP");
    expect(storedVerificationMethod({ method: "INVITATION_CODE" })).toBe(
      "INVITATION_CODE"
    );
  });
});
