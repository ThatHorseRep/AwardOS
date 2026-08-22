import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  createTestDb,
  truncateAll,
  seedVotingFixture,
  type TestDb,
} from "../helpers/db";

/**
 * P4-4 — receipt verification across ballot statuses.
 *
 * A receipt is proof that a ballot was SUBMITTED at cast time. It is not a
 * lifetime guarantee that the ballot stays counted: integrity review can flag
 * a session (not currently counted) or invalidate it (excluded). The verifier
 * used to answer "No matching ballot receipt recorded." for both — telling a
 * voter whose receipt was genuinely issued that no such receipt exists.
 *
 * Contract pinned here:
 *   SUBMITTED   → valid, counted
 *   FLAGGED     → not counted; message says received + under review
 *   INVALIDATED → not counted; message says excluded/invalidated
 *   unknown     → invalid (no such ballot)
 *   tampered    → invalid (signature)
 *   other event → invalid (event mismatch)
 *
 * The review/invalidated wording is visible only to whoever holds the signed
 * receipt — no organizer identity, reasons, or internal metadata are exposed.
 */

let db: TestDb;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let voting: any;

const jsonRequest = (url: string, body: unknown, ip = "203.0.113.70") =>
  new NextRequest(`http://localhost:3000${url}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      "user-agent": "vitest",
    },
    body: JSON.stringify(body),
  });

beforeAll(async () => {
  db = await createTestDb();
  const { drizzle } = await import("drizzle-orm/pglite");
  const schema = await import("@/lib/db/schema");
  const mockDb = drizzle(db as never, { schema } as never);
  vi.doMock("@/lib/db", () => ({ db: mockDb }));

  votesRoute = await import("@/app/api/public/events/[slug]/votes/route");
  ballotSessionRoute = await import(
    "@/app/api/public/events/[slug]/ballot-session/route"
  );
  voting = await import("@/actions/voting");
});

let votesRoute: {
  POST: (request: NextRequest, ctx: { params: Promise<{ slug: string }> }) => Promise<Response>;
};
let ballotSessionRoute: {
  POST: (request: NextRequest, ctx: { params: Promise<{ slug: string }> }) => Promise<Response>;
};

afterEach(async () => {
  await truncateAll(db);
});

type Fixture = Awaited<ReturnType<typeof seedVotingFixture>>;

/** Full real submission through the routes; returns the issued receipt. */
async function castRealBallot(fixture: Fixture): Promise<string> {
  const sessionId = `sess_receipt_${Math.random().toString(36).slice(2)}`;
  const initRes = await ballotSessionRoute.POST(
    jsonRequest(`/api/public/events/${fixture.slug}/ballot-session`, { sessionId }),
    { params: Promise.resolve({ slug: fixture.slug }) }
  );
  expect(initRes.status).toBe(200);

  const res = await votesRoute.POST(
    jsonRequest(`/api/public/events/${fixture.slug}/votes`, {
      sessionId,
      votes: [{ categoryId: fixture.categoryId, nomineeId: fixture.nomineeId, skipped: false }],
    }),
    { params: Promise.resolve({ slug: fixture.slug }) }
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as { receipt?: string };
  expect(body.receipt).toBeTruthy();
  return body.receipt as string;
}

async function setSessionStatus(fixture: Fixture, status: string) {
  await db.query(
    `UPDATE vote_sessions SET status = $2 WHERE event_id = $1`,
    [fixture.eventId, status] as never[]
  );
}

describe("P4-4 receipt verification status paths", () => {
  it("verifies a currently-counted ballot", async () => {
    const fx = await seedVotingFixture(db);
    const receipt = await castRealBallot(fx);

    const result = await voting.verifyBallotReceiptAction(fx.slug, receipt);
    expect(result.valid).toBe(true);
    expect(result.status).toBe("SUBMITTED");
    expect(result.eventName).toBe("Test Event");
  });

  it("tells a flagged-ballot holder the ballot is under review, not missing", async () => {
    const fx = await seedVotingFixture(db);
    const receipt = await castRealBallot(fx);
    await setSessionStatus(fx, "FLAGGED");

    const result = await voting.verifyBallotReceiptAction(fx.slug, receipt);

    // Was: "No matching ballot receipt recorded." — implied the receipt never
    // existed rather than that the ballot left the tally pending review.
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/review/i);
    expect(result.message).toMatch(/counted|tally|included/i);
  });

  it("tells an invalidated-ballot holder the ballot was excluded", async () => {
    const fx = await seedVotingFixture(db);
    const receipt = await castRealBallot(fx);
    await setSessionStatus(fx, "INVALIDATED");

    const result = await voting.verifyBallotReceiptAction(fx.slug, receipt);

    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/invalidat|excluded/i);
    expect(result.message).toMatch(/counted|tally|included/i);
  });

  it("rejects a well-formed but unknown receipt", async () => {
    const fx = await seedVotingFixture(db);
    const { issueBallotReceipt } = await import("@/lib/ballot-receipt");
    const stranger = issueBallotReceipt({
      eventId: fx.eventId,
      sessionId: "00000000-0000-0000-0000-000000000000",
      issuedAt: new Date().toISOString(),
    });

    const result = await voting.verifyBallotReceiptAction(fx.slug, stranger);
    expect(result.valid).toBe(false);
  });

  it("rejects tampered receipts", async () => {
    const fx = await seedVotingFixture(db);
    const receipt = await castRealBallot(fx);

    const result = await voting.verifyBallotReceiptAction(fx.slug, `${receipt}x`);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/altered|invalid/i);
  });

  it("rejects receipts belonging to a different event", async () => {
    const fx = await seedVotingFixture(db);
    const other = await seedVotingFixture(db, { slug: "other-event" });
    const receipt = await castRealBallot(other);

    const result = await voting.verifyBallotReceiptAction(fx.slug, receipt);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/different event/i);
  });
});
