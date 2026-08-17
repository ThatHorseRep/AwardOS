import { describe, expect, it } from "vitest";
import {
  getBallotRosterHash,
  getInvalidBallotCategoryNames,
} from "@/lib/ballot-review";

const categories = [
  {
    id: "c1",
    name: "Community impact",
    displayOrder: 1,
    maxNomineesPerVoter: 1,
  },
];
const nominees = [
  { id: "n1", categoryId: "c1", name: "Ada Mensah", displayOrder: 1 },
];

describe("ballot review contract", () => {
  it("changes the review hash whenever the approved roster changes", () => {
    const approved = getBallotRosterHash(categories, nominees);
    expect(
      getBallotRosterHash(categories, [
        { ...nominees[0], name: "Ada K. Mensah" },
      ]),
    ).not.toBe(approved);
    expect(
      getBallotRosterHash(
        [{ ...categories[0], maxNomineesPerVoter: 2 }],
        nominees,
      ),
    ).not.toBe(approved);
  });

  it("identifies every category that blocks activation", () => {
    expect(getInvalidBallotCategoryNames(categories, [])).toEqual([
      "Community impact",
    ]);
    expect(getInvalidBallotCategoryNames(categories, nominees)).toEqual([]);
  });
});
