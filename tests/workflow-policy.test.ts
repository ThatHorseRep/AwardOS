import { describe, expect, it } from "vitest";
import { evaluateWorkflowWindow, WORKFLOW_GRACE_MS } from "@/lib/workflow/policy";

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

  // P4-2: exact boundary pins. These document the intended concurrency
  // semantics — every comparison is inclusive on the allowed side.
  it("treats boundaries inclusively", () => {
    const ends = new Date("2026-08-15T11:00:00Z");
    // The closing instant itself is still open...
    expect(evaluateWorkflowWindow({ eventStatus: "ACTIVE", stage: activeStage, now: ends }).state).toBe("OPEN");
    // ...one millisecond later it is closed for fresh ballots.
    expect(evaluateWorkflowWindow({ eventStatus: "ACTIVE", stage: activeStage, now: new Date(ends.getTime() + 1) }).state).toBe("CLOSED");
    // Opening instant is included too.
    expect(evaluateWorkflowWindow({ eventStatus: "ACTIVE", stage: activeStage, now: activeStage.startsAt }).state).toBe("OPEN");
  });

  it("bounds the grace period on both sides", () => {
    const ends = new Date("2026-08-15T11:00:00Z");
    const lastInstant = (ms: number) => new Date(ends.getTime() + ms);
    // A session started at the closing instant is still grace-eligible...
    expect(evaluateWorkflowWindow({ eventStatus: "ACTIVE", stage: activeStage, now: lastInstant(WORKFLOW_GRACE_MS), startedAt: ends, allowInProgressGrace: true }).state).toBe("GRACE");
    // ...and grace expires exactly WORKFLOW_GRACE_MS after close.
    expect(evaluateWorkflowWindow({ eventStatus: "ACTIVE", stage: activeStage, now: lastInstant(WORKFLOW_GRACE_MS + 1), startedAt: ends, allowInProgressGrace: true }).state).toBe("CLOSED");
    // Sessions created after the deadline never qualify, however early they ask.
    expect(evaluateWorkflowWindow({ eventStatus: "ACTIVE", stage: activeStage, now: lastInstant(60_000), startedAt: lastInstant(30_000), allowInProgressGrace: true }).state).toBe("CLOSED");
  });

  it("lets an operator hard-stop voting by completing the event", () => {
    // Two-tier close: ending the stage window grants in-progress voters their
    // grace period, but flipping the event to COMPLETED revokes it instantly.
    const graceNow = new Date("2026-08-15T11:05:00Z");
    expect(evaluateWorkflowWindow({ eventStatus: "COMPLETED", stage: activeStage, now: graceNow, startedAt: new Date("2026-08-15T10:59:00Z"), allowInProgressGrace: true })).toEqual({ allowed: false, state: "EVENT_INACTIVE" });
  });
});
