"use server";

import { db } from "@/lib/db";
import { integrityAlerts } from "@/lib/db/schema/integrity";
import { voteSessions } from "@/lib/db/schema/voting";
import { eq, and, desc, inArray } from "drizzle-orm";

// Trigger integrity audit check
export async function triggerIntegrityScanAction(eventId: string) {
  // 1. Get all submitted vote sessions for this event
  const sessions = await db
    .select()
    .from(voteSessions)
    .where(
      and(
        eq(voteSessions.eventId, eventId),
        eq(voteSessions.status, "SUBMITTED")
      )
    );

  if (sessions.length === 0) {
    return {
      success: true,
      scannedCount: 0,
      alertsCreated: 0,
    };
  }

  // 2. Clear old unresolved alerts before recreating them
  await db
    .delete(integrityAlerts)
    .where(
      and(
        eq(integrityAlerts.eventId, eventId),
        eq(integrityAlerts.status, "NEW")
      )
    );

  const pendingAlerts: any[] = [];

  // --- DETECTOR 1: IP Clustering ---
  const ipMap: { [ip: string]: string[] } = {};
  sessions.forEach((s) => {
    if (s.ipAddress) {
      if (!ipMap[s.ipAddress]) {
        ipMap[s.ipAddress] = [];
      }
      ipMap[s.ipAddress].push(s.id);
    }
  });

  Object.entries(ipMap).forEach(([ip, sessionIds]) => {
    if (sessionIds.length > 3) {
      const severity = sessionIds.length > 10 ? "CRITICAL" : "WARNING";
      pendingAlerts.push({
        eventId,
        alertType: "IP_CLUSTER",
        severity,
        title: `IP Address Cluster: ${ip}`,
        description: `IP address ${ip} submitted ${sessionIds.length} ballots. Multiple votes from the same network endpoint may indicate script/proxy spam.`,
        affectedVotes: { ip, count: sessionIds.length, sessionIds },
        recommendation: `Disqualify duplicate ballots or review proxy traffic patterns for IP: ${ip}.`,
        status: "NEW",
      });
    }
  });

  // --- DETECTOR 2: Submission Velocity Spikes ---
  // Group ballots by 5-minute sliding intervals
  const intervalMap: { [interval: string]: string[] } = {};
  sessions.forEach((s) => {
    if (s.submittedAt) {
      const timeMs = new Date(s.submittedAt).getTime();
      const bucket = Math.floor(timeMs / (5 * 60 * 1000)) * (5 * 60 * 1000);
      const bucketKey = new Date(bucket).toISOString();

      if (!intervalMap[bucketKey]) {
        intervalMap[bucketKey] = [];
      }
      intervalMap[bucketKey].push(s.id);
    }
  });

  Object.entries(intervalMap).forEach(([intervalStr, sessionIds]) => {
    if (sessionIds.length > 10) {
      pendingAlerts.push({
        eventId,
        alertType: "VOTE_SPIKE",
        severity: "CRITICAL",
        title: `Ballot Submission Velocity Spike`,
        description: `Detected high-velocity submission spike: ${sessionIds.length} votes cast within 5-minute window starting at ${new Date(intervalStr).toLocaleTimeString()}.`,
        affectedVotes: { interval: intervalStr, count: sessionIds.length, sessionIds },
        recommendation: `Perform log verification checks to filter potential automation/bot runs.`,
        status: "NEW",
      });
    }
  });

  // --- DETECTOR 3: Duplicate Fingerprints ---
  const fingerprintMap: { [fingerprint: string]: string[] } = {};
  sessions.forEach((s) => {
    if (s.deviceFingerprint) {
      if (!fingerprintMap[s.deviceFingerprint]) {
        fingerprintMap[s.deviceFingerprint] = [];
      }
      fingerprintMap[s.deviceFingerprint].push(s.id);
    }
  });

  Object.entries(fingerprintMap).forEach(([fingerprint, sessionIds]) => {
    if (sessionIds.length > 1) {
      pendingAlerts.push({
        eventId,
        alertType: "DUPLICATE_FINGERPRINT",
        severity: "WARNING",
        title: `Duplicate Device Signatures`,
        description: `Client device fingerprint ${fingerprint.substring(0, 12)}... submitted ${sessionIds.length} separate ballots.`,
        affectedVotes: { fingerprint, count: sessionIds.length, sessionIds },
        recommendation: `Confirm cookies validation state or restrict access settings to verification modes.`,
        status: "NEW",
      });
    }
  });

  // 3. Batch insert the new alerts
  if (pendingAlerts.length > 0) {
    await db.insert(integrityAlerts).values(pendingAlerts);
  }

  return {
    success: true,
    scannedCount: sessions.length,
    alertsCreated: pendingAlerts.length,
  };
}

// Get all integrity alerts for event dashboard
export async function getIntegrityAlertsAction(eventId: string) {
  return await db
    .select()
    .from(integrityAlerts)
    .where(eq(integrityAlerts.eventId, eventId))
    .orderBy(desc(integrityAlerts.createdAt));
}

// Get event vote sessions with statuses
export async function getEventVoteSessionsAction(eventId: string) {
  return await db
    .select()
    .from(voteSessions)
    .where(eq(voteSessions.eventId, eventId))
    .orderBy(desc(voteSessions.submittedAt));
}

// Resolve integrity alert & optionally invalidate sessions
export async function resolveAlertAction(
  alertId: string,
  options: {
    status: "RESOLVED" | "DISMISSED";
    note: string;
    disqualifySessions?: string[];
  }
) {
  const { status, note, disqualifySessions } = options;

  await db.transaction(async (tx) => {
    // 1. Update alert resolution metadata
    await tx
      .update(integrityAlerts)
      .set({
        status,
        resolutionNote: note,
        resolvedAt: new Date(),
      })
      .where(eq(integrityAlerts.id, alertId));

    // 2. Disqualify sessions if provided
    if (disqualifySessions && disqualifySessions.length > 0) {
      await tx
        .update(voteSessions)
        .set({
          status: "INVALIDATED",
        })
        .where(inArray(voteSessions.id, disqualifySessions));
    }
  });

  return { success: true };
}

// Quarantine vote sessions for manual review
export async function quarantineSessionsAction(sessionIds: string[]) {
  if (!sessionIds || sessionIds.length === 0) return { success: true };
  await db
    .update(voteSessions)
    .set({ status: "QUARANTINED" as any })
    .where(inArray(voteSessions.id, sessionIds));
  return { success: true };
}

// Restore invalidated or quarantined vote sessions back to SUBMITTED
export async function restoreSessionsAction(sessionIds: string[]) {
  if (!sessionIds || sessionIds.length === 0) return { success: true };
  await db
    .update(voteSessions)
    .set({ status: "SUBMITTED" })
    .where(inArray(voteSessions.id, sessionIds));
  return { success: true };
}
