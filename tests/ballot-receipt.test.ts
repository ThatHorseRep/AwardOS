import { afterEach, describe, expect, it } from "vitest";
import { issueBallotReceipt, verifyBallotReceipt } from "@/lib/ballot-receipt";

const originalSecret = process.env.BALLOT_RECEIPT_SECRET;

afterEach(() => {
  process.env.BALLOT_RECEIPT_SECRET = originalSecret;
});

describe("ballot receipts", () => {
  it("round trips an event-bound signed receipt", () => {
    process.env.BALLOT_RECEIPT_SECRET = "test-secret";
    const payload = {
      eventId: "event-1",
      sessionId: "session-1",
      issuedAt: "2026-08-16T12:00:00.000Z",
    };
    expect(verifyBallotReceipt(issueBallotReceipt(payload))).toEqual(payload);
  });

  it("rejects a modified receipt", () => {
    process.env.BALLOT_RECEIPT_SECRET = "test-secret";
    const receipt = issueBallotReceipt({
      eventId: "event-1",
      sessionId: "session-1",
      issuedAt: "2026-08-16T12:00:00.000Z",
    });
    expect(verifyBallotReceipt(`${receipt.slice(0, -1)}x`)).toBeNull();
  });
});
