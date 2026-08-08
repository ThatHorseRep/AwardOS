import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { events, nominations as nominationsTable, suggestedCategories } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { syncNomineesForEvent } from "@/lib/nominations/sync";
import {
  sanitizePlainText,
  MAX_NOMINEE_TEXT_LENGTH,
  MAX_SUGGESTION_TEXT_LENGTH,
} from "@/lib/sanitize";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { nominations, suggestedCategory, sessionId } = body;

    // 1. Verify event exists
    const eventList = await db
      .select()
      .from(events)
      .where(and(eq(events.slug, slug), isNull(events.deletedAt)))
      .limit(1);

    if (eventList.length === 0) {
      return NextResponse.json(
        { error: "Event not found." },
        { status: 404 }
      );
    }

    const event = eventList[0];

    // 2. Validate session and request
    const actualSessionId = sessionId || `sess_${Math.random().toString(36).substring(2)}_${Date.now()}`;
    const ipAddress = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "";

    // 3. Save to database in a transaction
    let hasNominations = false;
    await db.transaction(async (tx) => {
      // Save nominations
      if (nominations && Array.isArray(nominations) && nominations.length > 0) {
        for (const nom of nominations) {
          // This endpoint is public and unauthenticated, so the text is cleaned
          // at the boundary rather than at each of the places it is later
          // rendered — exports, certificates and AI prompts all read the stored
          // value, and only the React views escape it for themselves.
          const nomineeText = sanitizePlainText(nom?.nomineeText, MAX_NOMINEE_TEXT_LENGTH);
          if (!nom?.categoryId || !nomineeText) continue;
          await tx.insert(nominationsTable).values({
            eventId: event.id,
            categoryId: nom.categoryId,
            nomineeText,
            sessionId: actualSessionId,
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
        console.warn("[Nominations] Post-submit nominee sync failed:", (syncErr as any)?.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Nominations submitted successfully!",
    });
  } catch (error: any) {
    console.error("Nomination submission error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error submitting nominations." },
      { status: 500 }
    );
  }
}
