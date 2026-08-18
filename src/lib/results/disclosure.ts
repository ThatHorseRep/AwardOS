export type ResultsDisclosureMode = "HIDDEN" | "RANKINGS" | "PERCENTAGES" | "VOTE_COUNTS" | "FULL_LEADERBOARD";

export type DisclosableCandidate = {
  id: string;
  name: string;
  bio: string | null;
  votes: number;
  rawVotes: number;
  rank: number;
  percent: string;
  percentNum: number;
  badgeStatus: string;
  status?: unknown;
  [key: string]: unknown;
};

export type DisclosedCandidate = {
  id: string;
  name: string;
  bio: string | null;
  rank: number;
  badgeStatus: string;
  status?: unknown;
  votes?: number;
  rawVotes?: number;
  percent?: string;
  percentNum?: number;
};

export function discloseCandidate(candidate: DisclosableCandidate, mode: ResultsDisclosureMode): DisclosedCandidate {
  const base = {
    id: candidate.id,
    name: candidate.name,
    bio: candidate.bio,
    rank: candidate.rank,
    badgeStatus: candidate.badgeStatus,
    ...(candidate.status !== undefined ? { status: candidate.status } : {}),
  };
  if (mode === "RANKINGS") return base;
  if (mode === "PERCENTAGES") return { ...base, percent: candidate.percent, percentNum: candidate.percentNum };
  if (mode === "VOTE_COUNTS") return { ...base, votes: candidate.votes };
  return { ...base, votes: candidate.votes, rawVotes: candidate.rawVotes, percent: candidate.percent, percentNum: candidate.percentNum };
}
