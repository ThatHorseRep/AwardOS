import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import {
  createTestDb,
  seedVotingFixture,
  truncateAll,
  type TestDb,
} from "../helpers/db";

/**
 * Publication freezing (P3-F1) and winner integrity under disqualification /
 * rank overrides (P3-F2), driven through the real server actions.
 *
 * Contract pinned here:
 * 1. Before publication, a non-hidden liveResultsMode serves LIVE standings.
 * 2. Publishing snapshots the official record; afterwards the public page
 *    serves the frozen snapshot — later votes/invalidate actions must not move
 *    it. Only an explicit re-publication refreshes what the public sees.
 * 3. Disqualified nominees are never ranked as winner anywhere: live
 *    tabulation, the published snapshot, and the certificate query must agree,
 *    promoting the next eligible nominee instead.
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
        member: null,
        event: { id: eventId },
      }),
    };
  });

  actions = await import("@/actions/results");
});

afterEach(async () => {
  await truncateAll(db);
  ctx.value = null;
});

type Fixture = Awaited<ReturnType<typeof seedVotingFixture>>;

async function addNominee(fixture: Fixture, name: string): Promise<string> {
  const res = await db.query<{ id: string }>(
    `INSERT INTO nominees (event_id, category_id, name, normalized_name, display_order, status)
     VALUES ($1, $2, $3, $4, 2, 'ACTIVE') RETURNING id`,
    [fixture.eventId, fixture.categoryId, name, name.toLowerCase()] as never[]
  );
  return res.rows[0].id;
}

/** One SUBMITTED session whose single selection goes to `nomineeId`. */
async function castBallot(
  fixture: Fixture,
  nomineeId: string,
  tokenSuffix: string
): Promise<string> {
  const res = await db.query<{ id: string }>(
    `INSERT INTO vote_sessions (event_id, session_token, status, submitted_at)
     VALUES ($1, $2, 'SUBMITTED', now()) RETURNING id`,
    [fixture.eventId, `tok-${tokenSuffix}-${Math.random()}`] as never[]
  );
  const sessionId = res.rows[0].id;
  await db.query(
    `INSERT INTO votes (vote_session_id, event_id, category_id, nominee_id, skipped)
     VALUES ($1, $2, $3, $4, false)`,
    [sessionId, fixture.eventId, fixture.categoryId, nomineeId] as never[]
  );
  return sessionId;
}

async function castBallots(
  fixture: Fixture,
  nomineeId: string,
  count: number,
  prefix: string
): Promise<void> {
  for (let i = 0; i < count; i++) await castBallot(fixture, nomineeId, `${prefix}-${i}`);
}

async function setMode(eventId: string, mode: string): Promise<void> {
  await db.query(`UPDATE events SET live_results_mode = $1 WHERE id = $2`, [
    mode,
    eventId,
  ] as never[]);
}

type Winner = {
  id: string;
  rank: number;
  badgeStatus: string;
  status?: string;
  votes?: number;
  rawVotes?: number;
  percentNum?: number;
};

function categoryOf(payload: { categoriesResults: Array<{ id: string; winners: Winner[] }> }) {
  expect(payload.categoriesResults).toHaveLength(1);
  return payload.categoriesResults[0];
}

async function officialRow(nomineeId: string) {
  const res = await db.query<{
    is_winner: boolean | null;
    is_disqualified: boolean | null;
    final_rank: number;
  }>(
    `SELECT is_winner, is_disqualified, final_rank FROM official_results WHERE nominee_id = $1`,
    [nomineeId] as never[]
  );
  return res.rows[0];
}

describe("P3-F1 publication freezing", () => {
  it("serves live standings before publication when disclosure is enabled", async () => {
    const f = await seedVotingFixture(db, { slug: "live-pre-pub" });
    await setMode(f.eventId, "VOTE_COUNTS");
    await castBallot(f, f.nomineeId, "a");

    let payload = await actions.getPublicEventResultsAction(f.slug);
    expect(categoryOf(payload).winners[0]).toMatchObject({
      id: f.nomineeId,
      votes: 1,
    });

    // A new ballot must still move pre-publication standings.
    await castBallot(f, f.nomineeId, "a2");
    payload = await actions.getPublicEventResultsAction(f.slug);
    expect(categoryOf(payload).winners[0].votes).toBe(2);
  });

  it("freezes public results at publish time until an explicit re-publish", async () => {
    const f = await seedVotingFixture(db, { slug: "freeze-basic" });
    const bob = await addNominee(f, "Bob");
    await castBallots(f, f.nomineeId, 2, "alice");
    await castBallots(f, bob, 1, "bob");

    ctx.value = { user: { id: f.userId }, workspace: { id: f.workspaceId } };
    await actions.publishResultsAction(f.eventId, true);

    const frozen = categoryOf(await actions.getPublicEventResultsAction(f.slug));
    expect(frozen.winners.map((w) => [w.id, w.votes])).toEqual([
      [f.nomineeId, 2],
      [bob, 1],
    ]);

    // Votes arriving after publication must not move the public record…
    await castBallots(f, bob, 2, "late");
    const stillFrozen = categoryOf(await actions.getPublicEventResultsAction(f.slug));
    expect(stillFrozen.winners.map((w) => [w.id, w.votes])).toEqual([
      [f.nomineeId, 2],
      [bob, 1],
    ]);

    // …while the organizer dashboard keeps showing both truths: the official
    // record stays at its published state, and the raw column exposes the drift.
    const live = categoryOf(await actions.getEventResultsAction(f.eventId));
    expect(live.winners.map((w) => [w.id, w.votes])).toEqual([
      [f.nomineeId, 2],
      [bob, 1],
    ]);
    expect(live.winners.map((w) => [w.id, w.rawVotes])).toEqual([
      [f.nomineeId, 2],
      [bob, 3],
    ]);

    // An explicit re-publication refreshes the public record.
    await actions.publishResultsAction(f.eventId, true);
    const refreshed = categoryOf(await actions.getPublicEventResultsAction(f.slug));
    expect(refreshed.winners.map((w) => [w.id, w.votes])).toEqual([
      [bob, 3],
      [f.nomineeId, 2],
    ]);
  });

  it("keeps published numbers stable when a ballot is invalidated afterwards", async () => {
    const f = await seedVotingFixture(db, { slug: "freeze-invalidate" });
    const sessionId = await castBallot(f, f.nomineeId, "only");

    ctx.value = { user: { id: f.userId }, workspace: { id: f.workspaceId } };
    await actions.publishResultsAction(f.eventId, true);

    await db.query(`UPDATE vote_sessions SET status = 'INVALIDATED' WHERE id = $1`, [
      sessionId,
    ] as never[]);

    const payload = categoryOf(await actions.getPublicEventResultsAction(f.slug));
    expect(payload.winners[0]).toMatchObject({ id: f.nomineeId, votes: 1 });
  });

  it("hides everything when unpublished after publication", async () => {
    const f = await seedVotingFixture(db, { slug: "hide-cycle" });
    await castBallot(f, f.nomineeId, "x");

    ctx.value = { user: { id: f.userId }, workspace: { id: f.workspaceId } };
    await actions.publishResultsAction(f.eventId, true);
    await actions.publishResultsAction(f.eventId, false);

    const hidden = await actions.getPublicEventResultsAction(f.slug);
    expect(hidden.categoriesResults).toEqual([]);
    expect(hidden.liveResultsMode).toBe("HIDDEN");
  });

  it("returns nothing for private events", async () => {
    const f = await seedVotingFixture(db, { slug: "private-ev" });
    await db.query(`UPDATE events SET visibility = 'PRIVATE' WHERE id = $1`, [
      f.eventId,
    ] as never[]);
    expect(await actions.getPublicEventResultsAction(f.slug)).toBeNull();
  });
});

describe("P3-F2 winner integrity", () => {
  it("snapshots the top eligible nominee as the sole winner", async () => {
    const f = await seedVotingFixture(db, { slug: "winner-normal" });
    const bob = await addNominee(f, "Bob");
    await castBallots(f, f.nomineeId, 5, "a");
    await castBallots(f, bob, 3, "b");

    ctx.value = { user: { id: f.userId }, workspace: { id: f.workspaceId } };
    await actions.publishResultsAction(f.eventId, true);

    expect(await officialRow(f.nomineeId)).toMatchObject({
      is_winner: true,
      is_disqualified: false,
      final_rank: 1,
    });
    expect(await officialRow(bob)).toMatchObject({
      is_winner: false,
      is_disqualified: false,
      final_rank: 2,
    });
  });

  it("promotes the runner-up when a published winner is disqualified", async () => {
    const f = await seedVotingFixture(db, { slug: "dq-promote" });
    const bob = await addNominee(f, "Bob");
    await castBallots(f, f.nomineeId, 5, "a");
    await castBallots(f, bob, 3, "b");

    ctx.value = { user: { id: f.userId }, workspace: { id: f.workspaceId } };
    await actions.publishResultsAction(f.eventId, true);
    await actions.disqualifyNomineeAction(f.nomineeId, "DISQUALIFIED");

    expect(await officialRow(f.nomineeId)).toMatchObject({
      is_winner: false,
      is_disqualified: true,
      final_rank: 2,
    });
    expect(await officialRow(bob)).toMatchObject({
      is_winner: true,
      is_disqualified: false,
      final_rank: 1,
    });

    // The certificate roster follows the reconciled official record.
    const certs = await actions.getPublishedCertificateCandidatesAction();
    const names = certs.map((c: { winnerName: string }) => c.winnerName);
    expect(names).toContain("Bob");
    expect(names).not.toContain("Alice");

    // The disqualification itself stays audited.
    const acts = await db.query<{ action_type: string }>(
      `SELECT action_type FROM result_actions WHERE event_id = $1`,
      [f.eventId] as never[]
    );
    expect(acts.rows.map((r) => r.action_type)).toContain("DISQUALIFY");
  });

  it("restores the original winner when a disqualification is reversed", async () => {
    const f = await seedVotingFixture(db, { slug: "dq-restore" });
    const bob = await addNominee(f, "Bob");
    await castBallots(f, f.nomineeId, 5, "a");
    await castBallots(f, bob, 3, "b");

    ctx.value = { user: { id: f.userId }, workspace: { id: f.workspaceId } };
    await actions.publishResultsAction(f.eventId, true);
    await actions.disqualifyNomineeAction(f.nomineeId, "DISQUALIFIED");
    await actions.disqualifyNomineeAction(f.nomineeId, "ACTIVE");

    expect(await officialRow(f.nomineeId)).toMatchObject({
      is_winner: true,
      is_disqualified: false,
      final_rank: 1,
    });
    expect(await officialRow(bob)).toMatchObject({
      is_winner: false,
      is_disqualified: false,
      final_rank: 2,
    });
  });

  it("never badges a disqualified nominee as live winner", async () => {
    const f = await seedVotingFixture(db, { slug: "dq-live-badge" });
    const bob = await addNominee(f, "Bob");
    await castBallots(f, f.nomineeId, 5, "a");
    await castBallots(f, bob, 3, "b");

    ctx.value = { user: { id: f.userId }, workspace: { id: f.workspaceId } };
    await actions.disqualifyNomineeAction(f.nomineeId, "DISQUALIFIED");

    const cat = categoryOf(await actions.getEventResultsAction(f.eventId));
    expect(cat.winners[0]).toMatchObject({
      id: bob,
      rank: 1,
      badgeStatus: "WINNER",
      percentNum: 100,
    });
    expect(cat.winners[1]).toMatchObject({
      id: f.nomineeId,
      status: "DISQUALIFIED",
      badgeStatus: "DISQUALIFIED",
      rank: 2,
    });
    expect(cat.winners.filter((w: Winner) => w.badgeStatus === "WINNER")).toHaveLength(1);
  });

  it("leaves no winner when every nominee is disqualified", async () => {
    const f = await seedVotingFixture(db, { slug: "dq-all" });
    const bob = await addNominee(f, "Bob");
    await castBallots(f, f.nomineeId, 5, "a");
    await castBallots(f, bob, 3, "b");

    ctx.value = { user: { id: f.userId }, workspace: { id: f.workspaceId } };
    await actions.publishResultsAction(f.eventId, true);
    await actions.disqualifyNomineeAction(f.nomineeId, "DISQUALIFIED");
    await actions.disqualifyNomineeAction(bob, "DISQUALIFIED");

    const rows = await db.query<{ is_winner: boolean | null }>(
      `SELECT is_winner FROM official_results WHERE event_id = $1`,
      [f.eventId] as never[]
    );
    expect(rows.rows.every((r) => r.is_winner === false)).toBe(true);

    const cat = categoryOf(await actions.getEventResultsAction(f.eventId));
    expect(
      cat.winners.some((w: Winner) => ["WINNER", "RUNNER_UP"].includes(w.badgeStatus))
    ).toBe(false);
  });

  it("keeps organizer and public winner consistent after publishing and disqualifying", async () => {
    const f = await seedVotingFixture(db, { slug: "dq-consistency" });
    const bob = await addNominee(f, "Bob");
    await castBallots(f, f.nomineeId, 5, "a");
    await castBallots(f, bob, 3, "b");

    ctx.value = { user: { id: f.userId }, workspace: { id: f.workspaceId } };
    await actions.publishResultsAction(f.eventId, true);
    await actions.disqualifyNomineeAction(f.nomineeId, "DISQUALIFIED");

    const orgCat = categoryOf(await actions.getEventResultsAction(f.eventId));
    const pubCat = categoryOf(await actions.getPublicEventResultsAction(f.slug));

    const orgWinner = orgCat.winners.find(
      (w: Winner) => w.badgeStatus === "WINNER"
    );
    const pubWinner = pubCat.winners.find(
      (w: Winner) => w.badgeStatus === "WINNER"
    );
    expect(orgWinner?.id).toBe(bob);
    expect(pubWinner?.id).toBe(bob);
  });

  it("applies rank overrides to the winner determination consistently", async () => {
    const f = await seedVotingFixture(db, { slug: "override-promote" });
    const bob = await addNominee(f, "Bob");
    await castBallots(f, f.nomineeId, 5, "a");
    await castBallots(f, bob, 3, "b");

    ctx.value = { user: { id: f.userId }, workspace: { id: f.workspaceId } };
    await actions.publishResultsAction(f.eventId, true);

    const bobResult = await db.query<{ id: string }>(
      `SELECT id FROM official_results WHERE nominee_id = $1`,
      [bob] as never[]
    );
    await actions.updateOfficialResultOverrideAction({
      eventId: f.eventId,
      officialResultId: bobResult.rows[0].id,
      rank: 1,
      reason: "Judges' tiebreak decision",
    });

    expect(await officialRow(bob)).toMatchObject({
      is_winner: true,
      final_rank: 1,
    });
    expect(await officialRow(f.nomineeId)).toMatchObject({
      is_winner: false,
      final_rank: 2,
    });
  });
});
