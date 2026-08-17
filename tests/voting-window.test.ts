import { describe, expect, it } from "vitest";
import { canSubmitBallotAt } from "@/lib/voting-window";

describe("voting deadline window", () => {
  const start = new Date("2026-08-15T10:00:00Z");
  const end = new Date("2026-08-15T11:00:00Z");
  it("accepts a ballot during the scheduled window", () => expect(canSubmitBallotAt({ now: new Date("2026-08-15T10:30:00Z"), startsAt: start, endsAt: end, startedAt: null })).toBe(true));
  it("rejects before opening", () => expect(canSubmitBallotAt({ now: new Date("2026-08-15T09:59:59Z"), startsAt: start, endsAt: end, startedAt: null })).toBe(false));
  it("allows a session started before the deadline for exactly 15 minutes", () => expect(canSubmitBallotAt({ now: new Date("2026-08-15T11:15:00Z"), startsAt: start, endsAt: end, startedAt: new Date("2026-08-15T10:59:59Z") })).toBe(true));
  it("rejects a session started after the deadline", () => expect(canSubmitBallotAt({ now: new Date("2026-08-15T11:05:00Z"), startsAt: start, endsAt: end, startedAt: new Date("2026-08-15T11:00:01Z") })).toBe(false));
  it("rejects after the grace period", () => expect(canSubmitBallotAt({ now: new Date("2026-08-15T11:15:01Z"), startsAt: start, endsAt: end, startedAt: new Date("2026-08-15T10:50:00Z") })).toBe(false));
});
