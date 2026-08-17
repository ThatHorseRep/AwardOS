"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { archiveConfigs, auditLogs, events, nomineePrivacyRequests, nominees } from "@/lib/db/schema";
import { sanitizePlainText } from "@/lib/sanitize";
import { EVENT_ADMINS, requireEventAccess } from "./_rbac";

export type ArchiveConfigInput = {
  showWinners: boolean;
  showNominees: boolean;
  showStatistics: boolean;
  showOrganizers: boolean;
  showPhotos: boolean;
  showHighlights: boolean;
  isPublic: boolean;
};

export async function getArchiveConfigAction(eventId: string) {
  await requireEventAccess(eventId, EVENT_ADMINS, "manage_events");
  const [config] = await db.select().from(archiveConfigs).where(eq(archiveConfigs.eventId, eventId)).limit(1);
  return config ?? null;
}

export async function updateArchiveConfigAction(eventId: string, input: ArchiveConfigInput) {
  const { user, workspace } = await requireEventAccess(eventId, EVENT_ADMINS, "manage_events");
  const [config] = await db.insert(archiveConfigs).values({ eventId, ...input, updatedBy: user.id, updatedAt: new Date() }).onConflictDoUpdate({ target: archiveConfigs.eventId, set: { ...input, updatedBy: user.id, updatedAt: new Date() } }).returning();
  await db.insert(auditLogs).values({ workspaceId: workspace.id, eventId, actorId: user.id, action: "archive.config_updated", targetType: "archive_config", targetId: config.id, details: input });
  revalidatePath("/archive");
  revalidatePath(`/archive/${eventId}`);
  return config;
}

export async function submitNomineePrivacyRequestAction(formData: FormData) {
  const input = {
    eventSlug: String(formData.get("eventSlug") || ""),
    nomineeId: String(formData.get("nomineeId") || ""),
    requesterEmail: String(formData.get("requesterEmail") || ""),
    requestType: String(formData.get("requestType") || "") as "ANONYMIZE" | "REMOVE",
    reason: String(formData.get("reason") || ""),
  };
  if (!/^[0-9a-f-]{36}$/i.test(input.nomineeId) || !["ANONYMIZE", "REMOVE"].includes(input.requestType)) throw new Error("Invalid privacy request.");
  const email = input.requesterEmail.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 255) throw new Error("Enter a valid email address.");
  const reason = sanitizePlainText(input.reason, 1000);
  if (reason.length < 10) throw new Error("Explain the request in at least 10 characters.");
  const [record] = await db.select({ eventId: events.id, nomineeId: nominees.id }).from(events).innerJoin(archiveConfigs, and(eq(archiveConfigs.eventId, events.id), eq(archiveConfigs.isPublic, true))).innerJoin(nominees, and(eq(nominees.id, input.nomineeId), eq(nominees.eventId, events.id))).where(and(eq(events.slug, input.eventSlug), isNull(events.deletedAt))).limit(1);
  if (!record) throw new Error("This archived nominee is not available.");
  await db.insert(nomineePrivacyRequests).values({ eventId: record.eventId, nomineeId: record.nomineeId, requesterEmail: email, requestType: input.requestType, reason });
  return { success: true };
}

export async function getNomineePrivacyRequestsAction(eventId: string) {
  await requireEventAccess(eventId, EVENT_ADMINS, "manage_events");
  return db.select().from(nomineePrivacyRequests).where(eq(nomineePrivacyRequests.eventId, eventId)).orderBy(desc(nomineePrivacyRequests.createdAt));
}

export async function resolveNomineePrivacyRequestAction(requestId: string, approve: boolean, note: string) {
  const [request] = await db.select().from(nomineePrivacyRequests).where(eq(nomineePrivacyRequests.id, requestId)).limit(1);
  if (!request) throw new Error("Privacy request not found.");
  const { user, workspace } = await requireEventAccess(request.eventId, EVENT_ADMINS, "manage_events");
  await db.transaction(async (tx) => {
    if (approve && request.nomineeId) {
      await tx.update(nominees).set(request.requestType === "REMOVE" ? { status: "DISQUALIFIED", photoUrl: null, bio: null, updatedAt: new Date() } : { name: "Name withheld", normalizedName: `withheld-${request.nomineeId}`, photoUrl: null, bio: null, updatedAt: new Date() }).where(and(eq(nominees.id, request.nomineeId), eq(nominees.eventId, request.eventId)));
    }
    await tx.update(nomineePrivacyRequests).set({ status: approve ? "APPROVED" : "REJECTED", resolutionNote: sanitizePlainText(note, 1000), resolvedAt: new Date(), resolvedBy: user.id }).where(eq(nomineePrivacyRequests.id, requestId));
    await tx.insert(auditLogs).values({ workspaceId: workspace.id, eventId: request.eventId, actorId: user.id, action: approve ? "archive.privacy_request_approved" : "archive.privacy_request_rejected", targetType: "nominee_privacy_request", targetId: requestId });
  });
  revalidatePath(`/archive/${request.eventId}`);
  return { success: true };
}
