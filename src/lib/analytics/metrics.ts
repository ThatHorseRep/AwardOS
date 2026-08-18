export function buildHourlyVelocity(submittedAt: Array<Date | null>) {
  const counts = new Map<string, number>();
  for (const value of submittedAt) {
    if (!value) continue;
    const iso = value.toISOString();
    const bucket = `${iso.slice(0, 10)} ${iso.slice(11, 13)}:00 UTC`;
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([hour, votes]) => ({ hour, votes }));
}

export function summarizeDevices(userAgents: Array<string | null>) {
  const counts = { iOS: 0, Android: 0, Windows: 0, macOS: 0, Other: 0 };
  let mobile = 0;
  for (const value of userAgents) {
    const ua = value?.toLowerCase() ?? "";
    if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) { counts.iOS++; mobile++; }
    else if (ua.includes("android")) { counts.Android++; mobile++; }
    else if (ua.includes("windows")) counts.Windows++;
    else if (ua.includes("macintosh") || ua.includes("mac os")) counts.macOS++;
    else counts.Other++;
  }
  const total = userAgents.length;
  return {
    mobilePercent: total > 0 ? `${((mobile / total) * 100).toFixed(1)}%` : "0.0%",
    osBreakdown: Object.entries(counts).filter(([, count]) => count > 0).map(([name, count]) => ({ name, count, percent: total > 0 ? Math.round((count / total) * 100) : 0 })),
  };
}

export function formatAverageCompletionTime(values: Array<number | null>): string {
  const measured = values.filter((value): value is number => typeof value === "number" && value > 0);
  if (measured.length === 0) return "N/A";
  const averageSeconds = Math.floor(measured.reduce((sum, value) => sum + value, 0) / measured.length / 1000);
  const minutes = Math.floor(averageSeconds / 60);
  const seconds = averageSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}
