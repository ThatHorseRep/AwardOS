import { describe, expect, it } from "vitest";
import {
  batchCleanupItems,
  calculateLevenshteinSimilarity,
  normalizeCapitalization,
} from "@/lib/ai/cleanup";

describe("AI nomination cleanup primitives", () => {
  it("normalizes repeated whitespace and common name prefixes deterministically", () => {
    expect(normalizeCapitalization("  jANE   o'NEIL  ")).toBe("Jane O'Neil");
    expect(normalizeCapitalization("mCdonald")).toBe("McDonald");
  });

  it("returns stable similarity scores for duplicate candidates", () => {
    expect(calculateLevenshteinSimilarity("Jane Doe", "Jane Doe")).toBe(100);
    expect(calculateLevenshteinSimilarity("Jane Doe", "Jnae Doe")).toBe(75);
    expect(
      calculateLevenshteinSimilarity("Jane Doe", "Alex Smith"),
    ).toBeLessThan(50);
  });

  it("splits large cleanup inputs into bounded batches without losing order", () => {
    expect(batchCleanupItems([1, 2, 3, 4, 5], 2)).toEqual([
      [1, 2],
      [3, 4],
      [5],
    ]);
    expect(() => batchCleanupItems([1], 0)).toThrow("positive integer");
  });
});
