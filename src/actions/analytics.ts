"use server";

import { db } from "@/lib/db";
import { events, categories, nominees, votes, voteSessions } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function getEventAnalyticsAction(eventId: string) {
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

  const totalVotesCount = sessions.length;

  // --- 3. Compute Hourly Velocity ---
  const hourlyCounts: { [hour: string]: number } = {};
  sessions.forEach((s) => {
    if (s.submittedAt) {
      const date = new Date(s.submittedAt);
      const hours = String(date.getHours()).padStart(2, "0");
      const key = `${hours}:00`;
      hourlyCounts[key] = (hourlyCounts[key] || 0) + 1;
    }
  });

  const velocityData = Object.entries(hourlyCounts)
    .map(([hour, count]) => ({ hour, votes: count }))
    .sort((a, b) => a.hour.localeCompare(b.hour));

  const maxHourlyVotes = velocityData.length > 0 ? Math.max(...velocityData.map((v) => v.votes)) : 0;
  const peakHourEntry = velocityData.find((v) => v.votes === maxHourlyVotes);
  const peakHourWindow = peakHourEntry ? `${peakHourEntry.hour}` : "N/A";

  const finalVelocityData =
    velocityData.length > 0
      ? velocityData
      : [
          { hour: "09:00", votes: 0 },
          { hour: "10:00", votes: 0 },
          { hour: "11:00", votes: 0 },
          { hour: "12:00", votes: 0 },
        ];

  // --- 4. Mobile vs Desktop & OS Breakdown ---
  let mobile = 0;
  let desktop = 0;
  const osCounts: { [os: string]: number } = {
    iOS: 0,
    Android: 0,
    Windows: 0,
    macOS: 0,
    Other: 0,
  };

  sessions.forEach((s) => {
    const ua = (s.userAgent || "").toLowerCase();
    if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) {
      mobile++;
      osCounts.iOS++;
    } else if (ua.includes("android")) {
      mobile++;
      osCounts.Android++;
    } else if (ua.includes("windows")) {
      desktop++;
      osCounts.Windows++;
    } else if (ua.includes("macintosh") || ua.includes("mac os")) {
      desktop++;
      osCounts.macOS++;
    } else {
      desktop++;
      osCounts.Other++;
    }
  });

  const totalDeviceCount = mobile + desktop;
  const mobilePercent = totalDeviceCount > 0 ? ((mobile / totalDeviceCount) * 100).toFixed(1) + "%" : "0.0%";

  const osBreakdown = Object.entries(osCounts)
    .map(([os, count]) => ({
      name: os,
      count,
      percent: totalDeviceCount > 0 ? Math.round((count / totalDeviceCount) * 100) : 0,
    }))
    .filter((o) => o.count > 0);

  // --- 5. Avg Time spent to submit ---
  let totalTimeMs = 0;
  let timeCount = 0;
  sessions.forEach((s) => {
    if (s.timeSpentMs && s.timeSpentMs > 0) {
      totalTimeMs += s.timeSpentMs;
      timeCount++;
    }
  });

  let avgTimeString = "1m 24s";
  if (timeCount > 0) {
    const avgSecs = Math.floor(totalTimeMs / timeCount / 1000);
    const mins = Math.floor(avgSecs / 60);
    const secs = avgSecs % 60;
    avgTimeString = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }

  // --- 6. Turnout share by category ---
  const activeCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.eventId, eventId))
    .orderBy(categories.displayOrder);

  const categoryTurnout = [];

  for (const cat of activeCategories) {
    const votesCountResult = await db
      .select({
        count: sql<number>`count(${votes.id})::int`,
      })
      .from(votes)
      .innerJoin(voteSessions, eq(votes.voteSessionId, voteSessions.id))
      .where(
        and(
          eq(votes.categoryId, cat.id),
          eq(voteSessions.status, "SUBMITTED")
        )
      );

    const voteCount = votesCountResult[0]?.count || 0;
    const sharePercent = totalVotesCount > 0 ? Math.round((voteCount / totalVotesCount) * 100) : 0;

    categoryTurnout.push({
      name: cat.name,
      votes: voteCount,
      percent: sharePercent,
    });
  }

  return {
    totalVotesCount,
    peakVelocityRate: maxHourlyVotes > 0 ? `${maxHourlyVotes}/hr` : "0/hr",
    peakHourWindow,
    mobileShare: mobilePercent,
    avgCompletionTime: avgTimeString,
    velocityData: finalVelocityData,
    osBreakdown,
    categoryTurnout,
  };
}
