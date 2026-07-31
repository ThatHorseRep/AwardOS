import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  events,
  voteSessions,
  votes as votesTable,
  voterOtps,
  invitationCodes,
  categories,
} from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { votes, sessionId, verificationSession } = body;

    // 1. Verify event exists
    const eventList = await db
      .select()
      .from(events)
      .where(and(eq(events.slug, slug), isNull(events.deletedAt)))
      .limit(1);

    if (eventList.length === 0) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const event = eventList[0];
    const verificationConfig = (event.verificationConfig as any) || {};
    const expectedMethod = verificationConfig.method || "NONE";

    // 2. Validate Voter Authentication / Verification Session
    let verifiedEmail: string | null = null;
    let usedInvitationCode: string | null = null;

    if (expectedMethod === "EMAIL_OTP") {
      if (!verificationSession || !verificationSession.email || !verificationSession.otpId) {
        return NextResponse.json({ error: "Email verification is required." }, { status: 403 });
      }

      // Query voterOtps
      const otpList = await db
        .select()
        .from(voterOtps)
        .where(
          and(
            eq(voterOtps.id, verificationSession.otpId),
            eq(voterOtps.eventId, event.id),
            eq(voterOtps.email, verificationSession.email.trim().toLowerCase()),
            eq(voterOtps.verified, true)
          )
        )
        .limit(1);

      if (otpList.length === 0) {
        return NextResponse.json({ error: "Verification session invalid or unverified." }, { status: 403 });
      }

      verifiedEmail = verificationSession.email.trim().toLowerCase();

      // Check double-voting by verified email
      const existingVoteSession = await db
        .select()
        .from(voteSessions)
        .where(
          and(
            eq(voteSessions.eventId, event.id),
            eq(voteSessions.verifiedEmail, verifiedEmail as string)
          )
        )
        .limit(1);

      if (existingVoteSession.length > 0) {
        return NextResponse.json({ error: "You have already cast a ballot for this event." }, { status: 400 });
      }
    } else if (expectedMethod === "INVITATION_CODE") {
      if (!verificationSession || !verificationSession.code) {
        return NextResponse.json({ error: "Invitation code is required." }, { status: 403 });
      }

      const cleanCode = verificationSession.code.trim().toUpperCase();

      // Query invitationCodes
      const codeList = await db
        .select()
        .from(invitationCodes)
        .where(
          and(
            eq(invitationCodes.code, cleanCode),
            eq(invitationCodes.eventId, event.id),
            eq(invitationCodes.status, "UNUSED")
          )
        )
        .limit(1);

      if (codeList.length === 0) {
        return NextResponse.json({ error: "Invitation code is invalid or has already been used." }, { status: 403 });
      }

      usedInvitationCode = cleanCode;
    } else {
      // NONE: Double-voting check by sessionId + eventId
      const existingVoteSession = await db
        .select()
        .from(voteSessions)
        .where(
          and(
            eq(voteSessions.eventId, event.id),
            eq(voteSessions.sessionToken, `ballot-${sessionId}`)
          )
        )
        .limit(1);

      if (existingVoteSession.length > 0) {
        return NextResponse.json({ error: "You have already cast a ballot for this event." }, { status: 400 });
      }
    }

    // 3. Save Ballot in Database Transaction
    const ballotId = `ballot-${sessionId || Math.random().toString(36).substring(2, 7)}-${Date.now()}`;
    const ipAddress = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "";

    const result = await db.transaction(async (tx) => {
      // Insert Vote Session
      const newSessionList = await tx
        .insert(voteSessions)
        .values({
          eventId: event.id,
          sessionToken: ballotId,
          ipAddress,
          userAgent,
          verificationMethod: expectedMethod,
          verifiedEmail,
          invitationCode: usedInvitationCode,
          status: "SUBMITTED",
          submittedAt: new Date(),
        })
        .returning({ id: voteSessions.id });

      const voteSessionId = newSessionList[0].id;

      // Fetch active categories to ensure we log skips properly
      const eventCategories = await tx
        .select()
        .from(categories)
        .where(and(eq(categories.eventId, event.id), eq(categories.isActive, true)));

      let categoriesVoted = 0;
      let categoriesSkipped = 0;

      for (const cat of eventCategories) {
        const nomineeId = votes[cat.id];
        if (nomineeId) {
          categoriesVoted++;
          await tx.insert(votesTable).values({
            voteSessionId,
            eventId: event.id,
            categoryId: cat.id,
            nomineeId,
            skipped: false,
          });
        } else {
          categoriesSkipped++;
          await tx.insert(votesTable).values({
            voteSessionId,
            eventId: event.id,
            categoryId: cat.id,
            nomineeId: null,
            skipped: true,
          });
        }
      }

      // Update counters in vote session
      await tx
        .update(voteSessions)
        .set({
          categoriesVoted,
          categoriesSkipped,
        })
        .where(eq(voteSessions.id, voteSessionId));

      // Mark invitation code used if applicable
      if (usedInvitationCode) {
        await tx
          .update(invitationCodes)
          .set({
            status: "USED",
            usedBySession: voteSessionId,
            usedAt: new Date(),
          })
          .where(eq(invitationCodes.code, usedInvitationCode));
      }

      return { voteSessionId, categoriesVoted };
    });

    return NextResponse.json({
      success: true,
      message: "Ballot cast successfully!",
      ballotId,
      voteCount: result.categoriesVoted,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Submit Ballot error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error submitting ballot." },
      { status: 500 }
    );
  }
}
