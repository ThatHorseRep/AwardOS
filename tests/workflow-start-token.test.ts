import { describe, expect, it } from "vitest";
import { issueWorkflowStartToken, verifyWorkflowStartToken } from "@/lib/workflow/start-token";

describe("workflow start tokens", () => {
  it("round-trips a signed nomination start", () => {
    const payload = { eventId: "event-1", stageType: "NOMINATIONS" as const, startedAt: "2026-08-15T10:59:00.000Z" };
    expect(verifyWorkflowStartToken(issueWorkflowStartToken(payload))).toEqual(payload);
  });

  it("rejects tampering", () => {
    const token = issueWorkflowStartToken({ eventId: "event-1", stageType: "NOMINATIONS", startedAt: "2026-08-15T10:59:00.000Z" });
    expect(verifyWorkflowStartToken(`${token.slice(0, -1)}x`)).toBeNull();
  });
});
