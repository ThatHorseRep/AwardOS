export function resultPercentage(votes: number, displayedTotal: number): number {
  if (displayedTotal <= 0) return 0;
  return (votes / displayedTotal) * 100;
}
