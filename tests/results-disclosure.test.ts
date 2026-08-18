import { describe, expect, it } from "vitest";
import { discloseCandidate } from "@/lib/results/disclosure";

const candidate = {
  id: "candidate-1",
  name: "Ada",
  bio: null,
  votes: 12,
  rawVotes: 10,
  rank: 1,
  percent: "60.0%",
  percentNum: 60,
  badgeStatus: "WINNER",
};

describe("public results disclosure", () => {
  it("rankings mode omits counts and percentages", () => {
    expect(discloseCandidate(candidate, "RANKINGS")).toEqual({ id: "candidate-1", name: "Ada", bio: null, rank: 1, badgeStatus: "WINNER" });
  });

  it("percentages mode exposes percentages without vote counts", () => {
    expect(discloseCandidate(candidate, "PERCENTAGES")).toMatchObject({ percent: "60.0%", percentNum: 60 });
    expect(discloseCandidate(candidate, "PERCENTAGES")).not.toHaveProperty("votes");
  });

  it("vote-count mode exposes adjusted counts without raw audit counts", () => {
    expect(discloseCandidate(candidate, "VOTE_COUNTS")).toMatchObject({ votes: 12 });
    expect(discloseCandidate(candidate, "VOTE_COUNTS")).not.toHaveProperty("rawVotes");
  });

  it("full leaderboard exposes counts and percentages", () => {
    expect(discloseCandidate(candidate, "FULL_LEADERBOARD")).toMatchObject({ votes: 12, rawVotes: 10, percent: "60.0%" });
  });
});
