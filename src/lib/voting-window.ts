export function canSubmitBallotAt(options: { now: Date; startsAt: Date | null; endsAt: Date | null; startedAt: Date | null; graceMs?: number }) {
  const { now, startsAt, endsAt, startedAt, graceMs = 15 * 60 * 1000 } = options;
  if (startsAt && now < startsAt) return false;
  if (!endsAt || now <= endsAt) return true;
  return Boolean(startedAt && startedAt <= endsAt && now.getTime() <= endsAt.getTime() + graceMs);
}
