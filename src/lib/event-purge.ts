import { and, eq, lt, notExists } from "drizzle-orm";
import { db } from "@/lib/db";
import { archiveConfigs, events } from "@/lib/db/schema";

export async function purgeExpiredDeletedEvents() {
  const cutoff = new Date(Date.now() - 30 * 86400000);
  const deleted = await db.delete(events).where(and(lt(events.deletedAt, cutoff), notExists(db.select({ id: archiveConfigs.id }).from(archiveConfigs).where(and(eq(archiveConfigs.eventId, events.id), eq(archiveConfigs.isPublic, true)))))).returning({ id: events.id });
  return { purged: deleted.length, cutoff: cutoff.toISOString() };
}
