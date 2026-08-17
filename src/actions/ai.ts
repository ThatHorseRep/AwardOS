"use server";

import { db } from "@/lib/db";
import { auditLogs, events } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireEventAccess, EVENT_ADMINS } from "./_rbac";
import { sanitizePlainText } from "@/lib/sanitize";

export async function insertAIDraftIntoEventDescriptionAction(eventId: string, content: string) {
  const { user, workspace } = await requireEventAccess(eventId, EVENT_ADMINS, "manage_events");
  const description = sanitizePlainText(content, 5000);
  if (description.length < 10) throw new Error("The generated draft is too short to insert.");
  await db.transaction(async (tx) => {
    await tx.update(events).set({ description, updatedAt: new Date() }).where(eq(events.id, eventId));
    await tx.insert(auditLogs).values({ workspaceId: workspace.id, eventId, actorId: user.id, action: "event.description_ai_inserted", targetType: "event", targetId: eventId, details: { characterCount: description.length } });
  });
  return { success: true };
}
