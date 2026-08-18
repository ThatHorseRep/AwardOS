import { describe, expect, it } from "vitest";
import { resultPercentage } from "@/lib/results/math";

describe("official result percentages", () => {
  it("uses the displayed adjusted total rather than the raw selection total", () => {
    const adjustedCounts = [8, 2];
    const displayedTotal = adjustedCounts.reduce((sum, count) => sum + count, 0);
    expect(resultPercentage(adjustedCounts[0], displayedTotal)).toBe(80);
    expect(resultPercentage(adjustedCounts[1], displayedTotal)).toBe(20);
  });

  it("returns zero for a void category", () => {
    expect(resultPercentage(0, 0)).toBe(0);
  });
});
