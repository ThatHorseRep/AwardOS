import { describe, expect, it } from "vitest";
import { evaluateWorkflowWindow } from "@/lib/workflow/policy";

const activeStage = {
  status: "ACTIVE" as const,
  startsAt: new Date("2026-08-15T10:00:00Z"),
  endsAt: new Date("2026-08-15T11:00:00Z"),
};

describe("workflow window policy", () => {
  it("requires an active event and active stage", () => {
    expect(evaluateWorkflowWindow({ eventStatus: "DRAFT", stage: activeStage, now: activeStage.startsAt })).toEqual({ allowed: false, state: "EVENT_INACTIVE" });
    expect(evaluateWorkflowWindow({ eventStatus: "ACTIVE", stage: { ...activeStage, status: "PENDING" }, now: activeStage.startsAt })).toEqual({ allowed: false, state: "STAGE_INACTIVE" });
  });

  it("distinguishes not-started, open, and closed windows", () => {
    expect(evaluateWorkflowWindow({ eventStatus: "ACTIVE", stage: activeStage, now: new Date("2026-08-15T09:59:59Z") }).state).toBe("NOT_STARTED");
    expect(evaluateWorkflowWindow({ eventStatus: "ACTIVE", stage: activeStage, now: new Date("2026-08-15T10:30:00Z") })).toEqual({ allowed: true, state: "OPEN" });
    expect(evaluateWorkflowWindow({ eventStatus: "ACTIVE", stage: activeStage, now: new Date("2026-08-15T11:15:01Z") }).state).toBe("CLOSED");
  });

  it("allows only sessions started by the deadline during the 15-minute grace period", () => {
    expect(evaluateWorkflowWindow({ eventStatus: "ACTIVE", stage: activeStage, now: new Date("2026-08-15T11:15:00Z"), startedAt: new Date("2026-08-15T10:59:59Z"), allowInProgressGrace: true })).toEqual({ allowed: true, state: "GRACE" });
    expect(evaluateWorkflowWindow({ eventStatus: "ACTIVE", stage: activeStage, now: new Date("2026-08-15T11:05:00Z"), startedAt: new Date("2026-08-15T11:00:01Z"), allowInProgressGrace: true }).state).toBe("CLOSED");
  });
});
