import { evaluateWorkflowWindow } from "@/lib/workflow/policy";

export function canSubmitBallotAt(options: { now: Date; startsAt: Date | null; endsAt: Date | null; startedAt: Date | null; graceMs?: number }) {
  return evaluateWorkflowWindow({
    eventStatus: "ACTIVE",
    stage: { status: "ACTIVE", startsAt: options.startsAt, endsAt: options.endsAt },
    now: options.now,
    startedAt: options.startedAt,
    allowInProgressGrace: true,
    graceMs: options.graceMs,
  }).allowed;
}
