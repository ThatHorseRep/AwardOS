import { createHmac, timingSafeEqual } from "node:crypto";

type ReceiptPayload = {
  eventId: string;
  sessionId: string;
  issuedAt: string;
};

function getReceiptSecret() {
  const secret = process.env.BALLOT_RECEIPT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") return "awardos-local-receipt-secret";
  throw new Error("Ballot receipt signing is not configured.");
}

function sign(encodedPayload: string) {
  return createHmac("sha256", getReceiptSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function issueBallotReceipt(payload: ReceiptPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `awardos.${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyBallotReceipt(receipt: string): ReceiptPayload | null {
  const [prefix, encodedPayload, signature, extra] = receipt.trim().split(".");
  if (prefix !== "awardos" || !encodedPayload || !signature || extra) return null;

  const expected = Buffer.from(sign(encodedPayload));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<ReceiptPayload>;
    if (
      typeof payload.eventId !== "string" ||
      typeof payload.sessionId !== "string" ||
      typeof payload.issuedAt !== "string" ||
      Number.isNaN(Date.parse(payload.issuedAt))
    ) {
      return null;
    }
    return payload as ReceiptPayload;
  } catch {
    return null;
  }
}
