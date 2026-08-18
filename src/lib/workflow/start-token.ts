import { createHmac, timingSafeEqual } from "node:crypto";

type WorkflowStartPayload = {
  eventId: string;
  stageType: "NOMINATIONS";
  startedAt: string;
};

function secret() {
  const configured = process.env.BALLOT_RECEIPT_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "awardos-local-receipt-secret";
  throw new Error("Workflow start-token signing is not configured.");
}

function signature(encodedPayload: string) {
  return createHmac("sha256", secret())
    .update(`workflow-start.${encodedPayload}`)
    .digest("base64url");
}

export function issueWorkflowStartToken(payload: WorkflowStartPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `awardos-start.${encoded}.${signature(encoded)}`;
}

export function verifyWorkflowStartToken(token: string): WorkflowStartPayload | null {
  const [prefix, encoded, suppliedSignature, extra] = token.trim().split(".");
  if (prefix !== "awardos-start" || !encoded || !suppliedSignature || extra) return null;

  const expected = Buffer.from(signature(encoded));
  const supplied = Buffer.from(suppliedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<WorkflowStartPayload>;
    if (
      typeof payload.eventId !== "string"
      || payload.stageType !== "NOMINATIONS"
      || typeof payload.startedAt !== "string"
      || Number.isNaN(Date.parse(payload.startedAt))
    ) return null;
    return payload as WorkflowStartPayload;
  } catch {
    return null;
  }
}
