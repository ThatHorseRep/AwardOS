"use server";

import { db } from "@/lib/db";
import { exportJobs, auditLogs } from "@/lib/db/schema/exports";
import { eq, desc } from "drizzle-orm";
import { ensureUserRecord } from "@/lib/ensure-user";
import { requireEventAccess, EVENT_ADMINS, CONTENT_MODERATORS } from "./_rbac";
import { buildExportPayload, type ExportType } from "@/lib/export-payload";
import { estimateExportRows } from "@/lib/export-payload";
import { after } from "next/server";

const BACKGROUND_EXPORT_THRESHOLD = 10_000;

async function completeExportJob(jobId: string, eventId: string, type: ExportType, includeSensitiveFields: boolean) {
  try {
    const payload = await buildExportPayload(eventId, type, includeSensitiveFields);
    await db.update(exportJobs).set({ status: "COMPLETED", rowCount: payload.length, payloadSnapshot: payload, completedAt: new Date() }).where(eq(exportJobs.id, jobId));
    return payload.length;
  } catch (error: unknown) {
    await db.update(exportJobs).set({ status: "FAILED", errorMessage: error instanceof Error ? error.message.slice(0, 1024) : "Export failed" }).where(eq(exportJobs.id, jobId));
    throw error;
  }
}

export async function createExportJobAction(
  eventId: string,
  type: ExportType,
  format: "CSV" | "XLSX" | "JSON" | "PDF",
  includeSensitiveFields = false
) {
  const { user } = await requireEventAccess(eventId, EVENT_ADMINS, "manage_events");

  await ensureUserRecord(user.id, user.email, user.displayName);

  // 1. Create PENDING job record
  const [job] = await db
    .insert(exportJobs)
    .values({
      eventId,
      requestedBy: user.id,
      exportType: type,
      format,
      status: "PROCESSING",
      includeSensitiveFields,
    })
    .returning();

  try {
    const estimatedRows = await estimateExportRows(eventId, type);
    if (estimatedRows > BACKGROUND_EXPORT_THRESHOLD) {
      after(async () => { try { await completeExportJob(job.id, eventId, type, includeSensitiveFields); } catch (error) { console.error("Background export generation failed:", error); } });
      return { success: true, jobId: job.id, rowCount: estimatedRows, ready: false };
    }

    const rowCount = await completeExportJob(job.id, eventId, type, includeSensitiveFields);

    return {
      success: true,
      jobId: job.id,
      rowCount,
      ready: true,
    };
  } catch (error: unknown) {
    console.error("Export generation error:", error);
    await db
      .update(exportJobs)
      .set({
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Export failed",
      })
      .where(eq(exportJobs.id, job.id));

    throw error;
  }
}

export async function getExportJobsAction(eventId: string) {
  await requireEventAccess(eventId, CONTENT_MODERATORS, "manage_nominees");

  return await db
    .select()
    .from(exportJobs)
    .where(eq(exportJobs.eventId, eventId))
    .orderBy(desc(exportJobs.createdAt));
}

export async function getAuditLogsAction(eventId: string) {
  // Audit rows include actor IPs — event admins only.
  await requireEventAccess(eventId, EVENT_ADMINS, "manage_events");

  return await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.eventId, eventId))
    .orderBy(desc(auditLogs.createdAt));
}
