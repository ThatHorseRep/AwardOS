"use server";

import { db } from "@/lib/db";
import { events, voteSessions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireEventAccess, ALL_MEMBERS } from "./_rbac";
import { getEventVoteAccounting } from "@/lib/voting/accounting";
import { buildHourlyVelocity, formatAverageCompletionTime, summarizeDevices } from "@/lib/analytics/metrics";

export async function getEventAnalyticsAction(eventId: string) {
  await requireEventAccess(eventId, ALL_MEMBERS, "view_analytics");

  // 1. Get event
  const eventList = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (eventList.length === 0) {
    throw new Error("Event not found");
  }

  // 2. Fetch all submitted sessions (excl. invalidated)
  const sessions = await db
    .select()
    .from(voteSessions)
    .where(
      and(
        eq(voteSessions.eventId, eventId),
        eq(voteSessions.status, "SUBMITTED")
      )
    );

  const accounting = await getEventVoteAccounting(eventId);

  // --- 3. Compute Hourly Velocity ---
  const velocityData = buildHourlyVelocity(sessions.map((session) => session.submittedAt));

  const maxHourlyVotes = velocityData.length > 0 ? Math.max(...velocityData.map((v) => v.votes)) : 0;
  const peakHourEntry = velocityData.find((v) => v.votes === maxHourlyVotes);
  const peakHourWindow = peakHourEntry ? `${peakHourEntry.hour}` : "N/A";

  const devices = summarizeDevices(sessions.map((session) => session.userAgent));

  // --- 5. Avg Time spent to submit ---
  const avgTimeString = formatAverageCompletionTime(sessions.map((session) => session.timeSpentMs));

  // --- 6. Turnout share by category ---
  const categoryTurnout = accounting.categories.map((category) => ({
    name: category.categoryName,
    responses: category.categoryResponses,
    selectedVotes: category.selectedVotes,
    skippedResponses: category.skippedResponses,
    percent: category.turnoutPercent,
  }));

  return {
    submittedBallots: accounting.submittedBallots,
    selectedVotes: accounting.selectedVotes,
    skippedResponses: accounting.skippedResponses,
    categoryResponses: accounting.categoryResponses,
    peakVelocityRate: maxHourlyVotes > 0 ? `${maxHourlyVotes}/hr` : "0/hr",
    peakHourWindow,
    mobileShare: devices.mobilePercent,
    avgCompletionTime: avgTimeString,
    velocityData,
    osBreakdown: devices.osBreakdown,
    categoryTurnout,
  };
}
