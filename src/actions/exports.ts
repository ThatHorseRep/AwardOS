"use server";

import { db } from "@/lib/db";
import { exportJobs, auditLogs } from "@/lib/db/schema/exports";
import { events, categories, nominees, votes, voteSessions, invitationCodes } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getCurrentUser, getOrCreateWorkspaceAction } from "./workspaces";
import { ensureUserRecord } from "@/lib/ensure-user";
import { requireEventAccess, EVENT_ADMINS, CONTENT_MODERATORS } from "./_rbac";

export async function createExportJobAction(
  eventId: string,
  type: "OFFICIAL_RESULTS" | "VOTE_TALLIES" | "AUDIT_TRAIL" | "INVITATION_CODES",
  format: "CSV" | "JSON" | "PDF" | "XLSX"
) {
  const { user } = await requireEventAccess(eventId, EVENT_ADMINS);

  await ensureUserRecord(user.id, user.email, user.displayName);

  // 1. Create PENDING job record
  const [job] = await db
    .insert(exportJobs)
    .values({
      eventId,
      requestedBy: user.id,
      exportType: type as any,
      format: format as any,
      status: "PROCESSING",
    })
    .returning();

  try {
    let payload: any[] = [];

    if (type === "OFFICIAL_RESULTS" || type === "VOTE_TALLIES") {
      // Fetch categories & nominee vote totals
      const cats = await db
        .select()
        .from(categories)
        .where(eq(categories.eventId, eventId))
        .orderBy(categories.displayOrder);

      for (const cat of cats) {
        const nomList = await db
          .select()
          .from(nominees)
          .where(eq(nominees.categoryId, cat.id))
          .orderBy(desc(nominees.nominationCount));

        for (const nom of nomList) {
          const voteCountResult = await db
            .select({ count: sql<number>`count(${votes.id})::int` })
            .from(votes)
            .innerJoin(voteSessions, eq(votes.voteSessionId, voteSessions.id))
            .where(
              and(
                eq(votes.nomineeId, nom.id),
                eq(voteSessions.status, "SUBMITTED")
              )
            );

          const totalCount = voteCountResult[0]?.count || 0;

          payload.push({
            Category: cat.name,
            Nominee: nom.name,
            Status: nom.status,
            Source: nom.source,
            TotalVotes: totalCount,
          });
        }
      }
    } else if (type === "INVITATION_CODES") {
      const codes = await db
        .select()
        .from(invitationCodes)
        .where(eq(invitationCodes.eventId, eventId))
        .orderBy(desc(invitationCodes.createdAt));

      payload = codes.map((c) => ({
        Code: c.code,
        Status: c.status,
        CreatedAt: c.createdAt.toISOString(),
        ExpiresAt: c.expiresAt ? c.expiresAt.toISOString() : "Never",
      }));
    } else {
      // AUDIT_TRAIL
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.eventId, eventId))
        .orderBy(desc(auditLogs.createdAt));

      payload = logs.map((l) => ({
        Action: l.action,
        TargetType: l.targetType,
        TargetId: l.targetId,
        IPAddress: l.ipAddress,
        Timestamp: l.createdAt.toISOString(),
      }));
    }

    const rowCount = payload.length;

    // Update job status to COMPLETED
    await db
      .update(exportJobs)
      .set({
        status: "COMPLETED",
        rowCount,
        completedAt: new Date(),
      })
      .where(eq(exportJobs.id, job.id));

    return {
      success: true,
      jobId: job.id,
      rowCount,
      data: payload,
    };
  } catch (error: any) {
    console.error("Export generation error:", error);
    await db
      .update(exportJobs)
      .set({
        status: "FAILED",
        errorMessage: error?.message || "Export failed",
      })
      .where(eq(exportJobs.id, job.id));

    throw error;
  }
}

export async function getExportJobsAction(eventId: string) {
  await requireEventAccess(eventId, CONTENT_MODERATORS);

  return await db
    .select()
    .from(exportJobs)
    .where(eq(exportJobs.eventId, eventId))
    .orderBy(desc(exportJobs.createdAt));
}

export async function getAuditLogsAction(eventId: string) {
  // Audit rows include actor IPs — event admins only.
  await requireEventAccess(eventId, EVENT_ADMINS);

  return await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.eventId, eventId))
    .orderBy(desc(auditLogs.createdAt));
}
