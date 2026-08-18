export const WORKFLOW_GRACE_MS = 15 * 60 * 1000;

export type WorkflowWindowState =
  | "OPEN"
  | "GRACE"
  | "EVENT_INACTIVE"
  | "STAGE_MISSING"
  | "STAGE_INACTIVE"
  | "NOT_STARTED"
  | "CLOSED";

export type WorkflowStageWindow = {
  status: "PENDING" | "ACTIVE" | "COMPLETED" | "SKIPPED";
  startsAt: Date | null;
  endsAt: Date | null;
};

export type WorkflowWindowEvaluation = {
  allowed: boolean;
  state: WorkflowWindowState;
};

export function evaluateWorkflowWindow(options: {
  eventStatus: string;
  stage: WorkflowStageWindow | null | undefined;
  now: Date;
  startedAt?: Date | null;
  allowInProgressGrace?: boolean;
  graceMs?: number;
}): WorkflowWindowEvaluation {
  const {
    eventStatus,
    stage,
    now,
    startedAt = null,
    allowInProgressGrace = false,
    graceMs = WORKFLOW_GRACE_MS,
  } = options;

  if (eventStatus !== "ACTIVE") return { allowed: false, state: "EVENT_INACTIVE" };
  if (!stage) return { allowed: false, state: "STAGE_MISSING" };
  if (stage.status !== "ACTIVE") return { allowed: false, state: "STAGE_INACTIVE" };
  if (stage.startsAt && now < stage.startsAt) return { allowed: false, state: "NOT_STARTED" };
  if (!stage.endsAt || now <= stage.endsAt) return { allowed: true, state: "OPEN" };

  const inGrace = allowInProgressGrace
    && startedAt !== null
    && startedAt <= stage.endsAt
    && now.getTime() <= stage.endsAt.getTime() + graceMs;

  return inGrace
    ? { allowed: true, state: "GRACE" }
    : { allowed: false, state: "CLOSED" };
}

export function workflowWindowMessage(
  subject: "Voting" | "Nominations",
  state: WorkflowWindowState,
): string {
  if (state === "NOT_STARTED") return `${subject} has not opened yet for this event.`;
  if (state === "CLOSED") return `${subject} has closed for this event.`;
  return `${subject} is not currently open for this event.`;
}
