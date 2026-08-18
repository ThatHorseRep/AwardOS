import { describe, expect, it } from "vitest";
import { buildHourlyVelocity, formatAverageCompletionTime, summarizeDevices } from "@/lib/analytics/metrics";

describe("analytics metrics", () => {
  it("keeps hourly buckets separate across dates", () => {
    expect(buildHourlyVelocity([new Date("2026-08-15T10:05:00Z"), new Date("2026-08-16T10:15:00Z")])).toEqual([
      { hour: "2026-08-15 10:00 UTC", votes: 1 },
      { hour: "2026-08-16 10:00 UTC", votes: 1 },
    ]);
  });

  it("classifies missing user agents as Other without calling them desktop", () => {
    expect(summarizeDevices([null, "Mozilla iPhone"]).mobilePercent).toBe("50.0%");
    expect(summarizeDevices([null]).osBreakdown).toEqual([{ name: "Other", count: 1, percent: 100 }]);
  });

  it("does not fabricate completion time when telemetry is absent", () => {
    expect(formatAverageCompletionTime([null, 0])).toBe("N/A");
    expect(formatAverageCompletionTime([60_000, 90_000])).toBe("1m 15s");
  });
});
