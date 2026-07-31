import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { events, nominations as nominationsTable, suggestedCategories } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

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
    await db.transaction(async (tx) => {
      // Save nominations
      if (nominations && Array.isArray(nominations) && nominations.length > 0) {
        for (const nom of nominations) {
          if (!nom.categoryId || !nom.nomineeText?.trim()) continue;
          await tx.insert(nominationsTable).values({
            eventId: event.id,
            categoryId: nom.categoryId,
            nomineeText: nom.nomineeText.trim(),
            sessionId: actualSessionId,
            ipAddress,
            userAgent,
          });
        }
      }

      // Save suggested category if present
      if (suggestedCategory && suggestedCategory.trim()) {
        await tx.insert(suggestedCategories).values({
          eventId: event.id,
          suggestionText: suggestedCategory.trim(),
          status: "PENDING",
          sessionId: actualSessionId,
        });
      }
    });

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
