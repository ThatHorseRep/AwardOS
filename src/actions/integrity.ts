"use server";

import { db } from "@/lib/db";
import { integrityAlerts } from "@/lib/db/schema/integrity";
import { users } from "@/lib/db/schema/users";
import { voteSessions } from "@/lib/db/schema/voting";
import { requireEventAccess, requireWorkspaceRole, CONTENT_MODERATORS, EVENT_ADMINS } from "./_rbac";
import { events } from "@/lib/db/schema/events";
import { eq, and, desc, inArray, isNull, sql } from "drizzle-orm";
import { sendAlertNotifications } from "@/lib/notifier";
import { auditLogs } from "@/lib/db/schema";

/**
 * Resolve the event that owns `alertId` and authorize against it.
 * Alerts are addressed by their own id, so the event has to be looked up before
 * the workspace check has anything to compare.
 */
async function requireAlertAccess(alertId: string, allowedRoles: Parameters<typeof requireEventAccess>[1]) {
  const [alert] = await db
    .select({ eventId: integrityAlerts.eventId })
    .from(integrityAlerts)
    .where(eq(integrityAlerts.id, alertId))
    .limit(1);

  if (!alert) {
    throw new Error("Alert not found");
  }

  return await requireEventAccess(alert.eventId, allowedRoles);
}

/**
 * Authorize a batch of vote-session ids.
 *
 * Every session must belong to a single event that the caller may administer.
 * A mixed batch is rejected outright rather than partially applied — silently
 * dropping the foreign ids would let an attacker probe which ones exist.
 */
async function requireSessionAccess(
  sessionIds: string[],
  allowedRoles: Parameters<typeof requireEventAccess>[1]
) {
  // Dedupe so a repeated id can't make the count check below disagree with the
  // number of rows that actually matched.
  const ids = [...new Set(sessionIds)];

  const owners = await db
    .selectDistinct({ eventId: voteSessions.eventId })
    .from(voteSessions)
    .where(inArray(voteSessions.id, ids));

  if (owners.length !== 1) {
    throw new Error("Vote sessions not found in a single event");
  }

  const access = await requireEventAccess(owners[0].eventId, allowedRoles);

  // The distinct query proves the ids share one event, but not that every id
  // resolved — a nonexistent id contributes no row. Count to be sure.
  const [{ found }] = await db
    .select({ found: sql<number>`count(*)::int` })
    .from(voteSessions)
    .where(
      and(
        inArray(voteSessions.id, ids),
        eq(voteSessions.eventId, access.event.id)
      )
    );

  if (found !== ids.length) {
    throw new Error("Vote sessions not found in a single event");
  }

  return access;
}

// Trigger integrity audit check
export async function triggerIntegrityScanAction(eventId: string) {
  await requireEventAccess(eventId, EVENT_ADMINS, "manage_events");

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

  const pendingAlerts: Array<typeof integrityAlerts.$inferInsert> = [];

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

  // --- DETECTOR 4: Bot-like IP + browser patterns ---
  const browserAgentMap: { [key: string]: string[] } = {};
  sessions.forEach((s) => {
    if (s.ipAddress && s.userAgent) {
      const key = `${s.ipAddress}|${s.userAgent}`;
      if (!browserAgentMap[key]) {
        browserAgentMap[key] = [];
      }
      browserAgentMap[key].push(s.id);
    }
  });

  Object.entries(browserAgentMap).forEach(([key, sessionIds]) => {
    if (sessionIds.length > 5) {
      const [ip] = key.split("|");
      pendingAlerts.push({
        eventId,
        alertType: "BOT_BEHAVIOR",
        severity: "WARNING",
        title: `Repeated Sessions from Same IP/Browser`,
        description: `Detected ${sessionIds.length} ballots from the same IP/browser combination. This may indicate scripted submissions or shared device abuse.`,
        affectedVotes: { ip, count: sessionIds.length, sessionIds },
        recommendation: `Inspect browser fingerprint data and consider blocking or challenging this traffic.`,
        status: "NEW",
      });
    }
  });

  // 3. Batch insert the new alerts and notify on critical ones.
  if (pendingAlerts.length > 0) {
    const insertedAlerts = await db.insert(integrityAlerts).values(pendingAlerts).returning();

    try {
      const critical = insertedAlerts.filter((p) => p.severity === "CRITICAL");
      await sendAlertNotifications(critical);
    } catch (err) {
      console.error("Failed to send alert notifications:", err);
    }
  }

  return {
    success: true,
    scannedCount: sessions.length,
    alertsCreated: pendingAlerts.length,
  };
}

// Get all integrity alerts for event dashboard
export async function getIntegrityAlertsAction(eventId: string) {
  await requireEventAccess(eventId, CONTENT_MODERATORS, "manage_nominees");

  return await db
    .select({
      id: integrityAlerts.id,
      eventId: integrityAlerts.eventId,
      alertType: integrityAlerts.alertType,
      severity: integrityAlerts.severity,
      title: integrityAlerts.title,
      description: integrityAlerts.description,
      affectedVotes: integrityAlerts.affectedVotes,
      recommendation: integrityAlerts.recommendation,
      status: integrityAlerts.status,
      resolvedBy: integrityAlerts.resolvedBy,
      resolvedAt: integrityAlerts.resolvedAt,
      resolutionNote: integrityAlerts.resolutionNote,
      createdAt: integrityAlerts.createdAt,
      resolvedByName: users.displayName,
    })
    .from(integrityAlerts)
    .leftJoin(users, eq(integrityAlerts.resolvedBy, users.id))
    .where(eq(integrityAlerts.eventId, eventId))
    .orderBy(desc(integrityAlerts.createdAt));
}

// Get event vote sessions with statuses
export async function getEventVoteSessionsAction(eventId: string) {
  // Session rows carry voter PII (email, IP, fingerprint) — moderators only.
  await requireEventAccess(eventId, CONTENT_MODERATORS, "manage_nominees");

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
  const { user, event, workspace } = await requireAlertAccess(alertId, EVENT_ADMINS);

  // `disqualifySessions` invalidates ballots by raw id. Authorizing the alert
  // says nothing about those ids, so confirm they belong to the same event
  // before any of them is touched.
  if (disqualifySessions && disqualifySessions.length > 0) {
    const { event: sessionEvent } = await requireSessionAccess(
      disqualifySessions,
      EVENT_ADMINS
    );
    if (sessionEvent.id !== event.id) {
      throw new Error("Vote sessions do not belong to this alert's event");
    }
  }

  await db.transaction(async (tx) => {
    // 1. Update alert resolution metadata
    await tx
      .update(integrityAlerts)
      .set({
        status,
        resolutionNote: note,
        resolvedAt: new Date(),
        resolvedBy: user?.id || null,
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
    await tx.insert(auditLogs).values({ workspaceId: workspace.id, eventId: event.id, actorId: user.id, action: status === "DISMISSED" ? "integrity.alert_dismissed" : "integrity.alert_resolved", targetType: "integrity_alert", targetId: alertId, details: { note, invalidatedSessionIds: disqualifySessions ?? [] } });
  });

  return { success: true };
}

// Acknowledge an alert (mark as seen by an admin)
export async function acknowledgeAlertAction(alertId: string, note?: string) {
  const { user, event, workspace } = await requireAlertAccess(alertId, EVENT_ADMINS);

  await db
    .update(integrityAlerts)
    .set({
      status: "ACKNOWLEDGED",
      resolutionNote: note || null,
      resolvedAt: new Date(),
      resolvedBy: user?.id || null,
    })
    .where(eq(integrityAlerts.id, alertId));
  await db.insert(auditLogs).values({ workspaceId: workspace.id, eventId: event.id, actorId: user.id, action: "integrity.alert_acknowledged", targetType: "integrity_alert", targetId: alertId, details: { note: note?.trim() || null } });

  return { success: true };
}

// Quarantine vote sessions for manual review
export async function quarantineSessionsAction(sessionIds: string[]) {
  if (!sessionIds || sessionIds.length === 0) return { success: true };
  const { user, event, workspace } = await requireSessionAccess(sessionIds, EVENT_ADMINS);

  await db
    .update(voteSessions)
    .set({ status: "FLAGGED" })
    .where(inArray(voteSessions.id, sessionIds));
  await db.insert(auditLogs).values({ workspaceId: workspace.id, eventId: event.id, actorId: user.id, action: "integrity.sessions_quarantined", targetType: "vote_session", details: { sessionIds: [...new Set(sessionIds)] } });
  return { success: true };
}

// Restore invalidated or quarantined vote sessions back to SUBMITTED
export async function restoreSessionsAction(sessionIds: string[]) {
  if (!sessionIds || sessionIds.length === 0) return { success: true };
  const { user, event, workspace } = await requireSessionAccess(sessionIds, EVENT_ADMINS);

  await db
    .update(voteSessions)
    .set({ status: "SUBMITTED" })
    .where(inArray(voteSessions.id, sessionIds));
  await db.insert(auditLogs).values({ workspaceId: workspace.id, eventId: event.id, actorId: user.id, action: "integrity.sessions_restored", targetType: "vote_session", details: { sessionIds: [...new Set(sessionIds)] } });
  return { success: true };
}

/**
 * Per-event integrity summary across the caller's workspace.
 *
 * Backs the workspace-level integrity directory, which previously rendered a
 * hardcoded list of invented threats — fabricated IPs, invented risk scores,
 * and a "purge" button that only filtered local state. On a voting product a
 * fake integrity dashboard is worse than none: it reports safety that was never
 * measured.
 */
export async function getWorkspaceIntegritySummaryAction() {
  const { workspace } = await requireWorkspaceRole(CONTENT_MODERATORS, "manage_nominees");

  const eventList = await db
    .select({ id: events.id, name: events.name, slug: events.slug, status: events.status })
    .from(events)
    .where(and(eq(events.workspaceId, workspace.id), isNull(events.deletedAt)))
    .orderBy(desc(events.createdAt));

  if (eventList.length === 0) return [];

  const eventIds = eventList.map((e) => e.id);

  // Two grouped queries rather than a pair per event.
  const alertRows = await db
    .select({
      eventId: integrityAlerts.eventId,
      status: integrityAlerts.status,
      severity: integrityAlerts.severity,
      count: sql<number>`count(*)::int`,
    })
    .from(integrityAlerts)
    .where(inArray(integrityAlerts.eventId, eventIds))
    .groupBy(integrityAlerts.eventId, integrityAlerts.status, integrityAlerts.severity);

  const sessionRows = await db
    .select({
      eventId: voteSessions.eventId,
      status: voteSessions.status,
      count: sql<number>`count(*)::int`,
    })
    .from(voteSessions)
    .where(inArray(voteSessions.eventId, eventIds))
    .groupBy(voteSessions.eventId, voteSessions.status);

  return eventList.map((event) => {
    const alerts = alertRows.filter((r) => r.eventId === event.id);
    const sessions = sessionRows.filter((r) => r.eventId === event.id);
    const sum = <T extends { count: number }>(rows: T[]) =>
      rows.reduce((n, r) => n + r.count, 0);

    return {
      ...event,
      openAlerts: sum(alerts.filter((a) => a.status === "NEW")),
      criticalAlerts: sum(
        alerts.filter((a) => a.status === "NEW" && a.severity === "CRITICAL")
      ),
      totalAlerts: sum(alerts),
      submittedBallots: sum(sessions.filter((s) => s.status === "SUBMITTED")),
      flaggedBallots: sum(
        sessions.filter((s) => s.status === "FLAGGED" || s.status === "INVALIDATED")
      ),
    };
  });
}
