import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exportJobs, auditLogs } from "@/lib/db/schema/exports";
import { events, categories, nominees, votes, voteSessions, invitationCodes } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireEventAccess, EVENT_ADMINS } from "@/actions/_rbac";
import { sanitizeSpreadsheetRows } from "@/lib/sanitize";
import * as XLSX from "xlsx";

export async function GET(
  request: NextRequest,
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
      await requireEventAccess(job.eventId, EVENT_ADMINS);
    } catch {
      // Deliberately identical to the not-found case above, so this cannot be
      // used to probe which job ids exist in other workspaces.
      return NextResponse.json({ error: "Export job not found" }, { status: 404 });
    }

    const eventId = job.eventId;
    const format = job.format as "CSV" | "JSON" | "PDF" | "XLSX";
    const type = job.exportType as string;

    let payload: any[] = [];

    if (type === "OFFICIAL_RESULTS" || type === "VOTE_TALLIES") {
      // Three queries total, regardless of size. This was a nested loop issuing
      // one COUNT per nominee per category — an event with 20 categories and 10
      // nominees each fired 201 queries to build one file.
      const cats = await db
        .select()
        .from(categories)
        .where(eq(categories.eventId, eventId))
        .orderBy(categories.displayOrder);

      const nomList = await db
        .select()
        .from(nominees)
        .where(eq(nominees.eventId, eventId))
        .orderBy(desc(nominees.nominationCount));

      const tallies = await db
        .select({
          nomineeId: votes.nomineeId,
          count: sql<number>`count(${votes.id})::int`,
        })
        .from(votes)
        .innerJoin(voteSessions, eq(votes.voteSessionId, voteSessions.id))
        .where(
          and(
            // Scoped to this event. The per-nominee count matched on nomineeId
            // alone, so a nominee appearing in more than one event had every
            // event's ballots folded into each export.
            eq(votes.eventId, eventId),
            eq(voteSessions.status, "SUBMITTED")
          )
        )
        .groupBy(votes.nomineeId);

      const votesByNominee = new Map(
        tallies.map((row) => [row.nomineeId, row.count])
      );
      const nomineesByCategory = new Map<string, typeof nomList>();
      for (const nom of nomList) {
        const list = nomineesByCategory.get(nom.categoryId);
        if (list) list.push(nom);
        else nomineesByCategory.set(nom.categoryId, [nom]);
      }

      for (const cat of cats) {
        for (const nom of nomineesByCategory.get(cat.id) ?? []) {
          payload.push({
            Category: cat.name,
            Nominee: nom.name,
            Status: nom.status,
            Source: nom.source,
            TotalVotes: votesByNominee.get(nom.id) ?? 0,
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

    const eventList = await db.select({ name: events.name }).from(events).where(eq(events.id, eventId)).limit(1);
    const eventName = (eventList[0]?.name || "export").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const filename = `${eventName}_${type.toLowerCase()}`;

    if (format === "JSON") {
      const jsonBuffer = Buffer.from(JSON.stringify(payload, null, 2), "utf-8");
      return new NextResponse(jsonBuffer, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${filename}.json"`,
        },
      });
    }

    // Nominee names in this payload come from the public nomination form, so a
    // cell can start with `=`, `+`, `-` or `@` and Excel/Sheets will execute it
    // the moment an organiser opens the file. JSON is left untouched — nothing
    // evaluates it — but every sheet-bound row is forced to literal text.
    const sheetRows = sanitizeSpreadsheetRows(payload);

    if (format === "CSV") {
      const worksheet = XLSX.utils.json_to_sheet(sheetRows);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      const csvBuffer = Buffer.from(csv, "utf-8");
      return new NextResponse(csvBuffer, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
        },
      });
    }

    // XLSX (default, also used for PDF placeholder)
    const worksheet = XLSX.utils.json_to_sheet(sheetRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, type);
    const xlsxBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(xlsxBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("Export download error:", error);
    return NextResponse.json({ error: error?.message || "Export download failed" }, { status: 500 });
  }
}
