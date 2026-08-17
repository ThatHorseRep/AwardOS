import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exportJobs } from "@/lib/db/schema/exports";
import { events, eventBranding } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireEventAccess, EVENT_ADMINS } from "@/actions/_rbac";
import { serializeExportSnapshot } from "@/lib/export-serialize";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    // Resolve the job first — the event it belongs to is what authorization is
    // checked against. A bare "is anyone signed in?" test used to be the only
    // gate here, which let any authenticated user download any workspace's
    // exports, invitation codes and audit trails included.
    const jobList = await db.select().from(exportJobs).where(eq(exportJobs.id, jobId)).limit(1);
    if (jobList.length === 0) {
      return NextResponse.json({ error: "Export job not found" }, { status: 404 });
    }
    const job = jobList[0];

    try {
      // Same bar as creating the export: these payloads carry invitation codes
      // (bearer credentials for voting) and audit-log IP addresses.
      await requireEventAccess(job.eventId, EVENT_ADMINS, "manage_events");
    } catch {
      // Deliberately identical to the not-found case above, so this cannot be
      // used to probe which job ids exist in other workspaces.
      return NextResponse.json({ error: "Export job not found" }, { status: 404 });
    }

    const eventId = job.eventId;
    const format = job.format as "CSV" | "XLSX" | "JSON" | "PDF";
    const type = job.exportType as string;
    const payload = job.payloadSnapshot as Array<Record<string, unknown>> | null;
    if (!payload || job.status !== "COMPLETED") return NextResponse.json({ error: "Export snapshot is not available." }, { status: 409 });

    const eventList = await db.select({ name: events.name, accentColor: eventBranding.accentColor }).from(events).leftJoin(eventBranding, eq(eventBranding.eventId, events.id)).where(eq(events.id, eventId)).limit(1);
    const eventName = (eventList[0]?.name || "export").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const filename = `${eventName}_${type.toLowerCase()}`;

    const serialized = await serializeExportSnapshot(payload, format, filename, type, { eventName: eventList[0]?.name, accentColor: eventList[0]?.accentColor });
    const body = Uint8Array.from(serialized.body).buffer;
    return new NextResponse(body, { headers: { "Content-Type": serialized.contentType, "Content-Disposition": serialized.disposition } });
  } catch (error: unknown) {
    console.error("Export download error:", error);
    console.error("Export download failed", error);
    return NextResponse.json({ error: "The export could not be downloaded. Please try again." }, { status: 500 });
  }
}
