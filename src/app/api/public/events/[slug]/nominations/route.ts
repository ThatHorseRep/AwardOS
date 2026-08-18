import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  categories,
  events,
  nominations as nominationsTable,
  suggestedCategories,
  workflowStages,
} from "@/lib/db/schema";
import { eq, and, inArray, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { syncNomineesForEvent } from "@/lib/nominations/sync";
import { submitNominationSchema } from "@/lib/validators";
import { getClientIp } from "@/lib/request-ip";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import {
  sanitizePlainText,
  MAX_NOMINEE_TEXT_LENGTH,
  MAX_SUGGESTION_TEXT_LENGTH,
} from "@/lib/sanitize";
import { evaluateWorkflowWindow, workflowWindowMessage } from "@/lib/workflow/policy";
import { verifyWorkflowStartToken } from "@/lib/workflow/start-token";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 64 * 1024) {
      return NextResponse.json({ error: "Request payload is too large." }, { status: 413 });
    }

    const parsed = submitNominationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid nomination submission.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { nominations, suggestedCategory, sessionId, nominationStartToken } = parsed.data;

    // 1. Verify event exists
    const eventList = await db
      .select()
      .from(events)
      .where(and(eq(events.slug, slug), isNull(events.deletedAt)))
      .limit(1);

    if (eventList.length === 0 || eventList[0].visibility === "PRIVATE" || eventList[0].status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Event not found." },
        { status: 404 }
      );
    }

    const event = eventList[0];
    const ipAddress = getClientIp(request.headers);
    const limit = await consumeRateLimit(`public-nominations:${event.id}`, ipAddress, { limit: 5, windowMs: 10 * 60 * 1000 });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many nomination submissions. Please try again later." },
        { status: 429, headers: rateLimitHeaders(limit) }
      );
    }

    const [nominationStage] = await db
      .select()
      .from(workflowStages)
      .where(
        and(
          eq(workflowStages.eventId, event.id),
          eq(workflowStages.stageType, "NOMINATIONS")
        )
      )
      .limit(1);

    const startPayload = nominationStartToken ? verifyWorkflowStartToken(nominationStartToken) : null;
    const startedAt = startPayload?.eventId === event.id ? new Date(startPayload.startedAt) : null;
    const nominationWindow = evaluateWorkflowWindow({
      eventStatus: event.status,
      stage: nominationStage,
      now: new Date(),
      startedAt,
      allowInProgressGrace: true,
    });
    if (!nominationWindow.allowed) {
      return NextResponse.json(
        { error: workflowWindowMessage("Nominations", nominationWindow.state) },
        { status: 403 }
      );
    }

    const requestedCategoryIds = [...new Set(nominations.map((nom) => nom.categoryId))];
    const validCategories = requestedCategoryIds.length
      ? await db
          .select({ id: categories.id })
          .from(categories)
          .where(
            and(
              eq(categories.eventId, event.id),
              eq(categories.isActive, true),
              inArray(categories.id, requestedCategoryIds)
            )
          )
      : [];

    if (validCategories.length !== requestedCategoryIds.length) {
      return NextResponse.json(
        { error: "One or more nomination categories are invalid." },
        { status: 400 }
      );
    }

    // 2. Validate session and request
    const actualSessionId = sessionId || `sess_${randomUUID()}`;
    const userAgent = (request.headers.get("user-agent") || "").slice(0, 512);

    // 3. Save to database in a transaction
    let hasNominations = false;
    await db.transaction(async (tx) => {
      // Save nominations
      if (nominations.length > 0) {
        const [previousSubmission] = await tx
          .select({ maxSubmissionNumber: sql<number>`coalesce(max(${nominationsTable.submissionNumber}), 0)` })
          .from(nominationsTable)
          .where(and(eq(nominationsTable.eventId, event.id), eq(nominationsTable.sessionId, actualSessionId)));
        const submissionNumber = Number(previousSubmission?.maxSubmissionNumber ?? 0) + 1;

        await tx
          .update(nominationsTable)
          .set({ isLatest: false })
          .where(and(eq(nominationsTable.eventId, event.id), eq(nominationsTable.sessionId, actualSessionId), eq(nominationsTable.isLatest, true)));

        for (const nom of nominations) {
          // This endpoint is public and unauthenticated, so the text is cleaned
          // at the boundary rather than at each of the places it is later
          // rendered — exports, certificates and AI prompts all read the stored
          // value, and only the React views escape it for themselves.
          const nomineeText = sanitizePlainText(nom.nomineeText, MAX_NOMINEE_TEXT_LENGTH);
          if (!nomineeText) continue;
          await tx.insert(nominationsTable).values({
            eventId: event.id,
            categoryId: nom.categoryId,
            nomineeText,
            sessionId: actualSessionId,
            submissionNumber,
            isLatest: true,
            ipAddress,
            userAgent,
          });
          hasNominations = true;
        }
      }

      // Save suggested category if present
      const suggestionText = sanitizePlainText(suggestedCategory, MAX_SUGGESTION_TEXT_LENGTH);
      if (suggestionText) {
        await tx.insert(suggestedCategories).values({
          eventId: event.id,
          suggestionText,
          status: "PENDING",
          sessionId: actualSessionId,
        });
      }
    });

    // 4. Sync raw nominations → nominees after submission (not on ballot page load)
    if (hasNominations) {
      try {
        // Called directly rather than through the server action: this request is
        // anonymous by design, and the action's workspace guard would reject it.
        // `event` above is already resolved from the slug and confirmed live, so
        // the id handed over here is never caller-supplied.
        await syncNomineesForEvent(event.id);
      } catch (syncErr) {
        // Non-fatal: nominations saved, nominee sync will retry on next AI cleanup
        console.warn(
          "[Nominations] Post-submit nominee sync failed:",
          syncErr instanceof Error ? syncErr.message : String(syncErr)
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Nominations submitted successfully.",
    });
  } catch (error: unknown) {
    console.error("Nomination submission error:", error);
    return NextResponse.json(
      { error: "Internal server error submitting nominations." },
      { status: 500 }
    );
  }
}
