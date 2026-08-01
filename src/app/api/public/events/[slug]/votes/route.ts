import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  events,
  voteSessions,
  votes as votesTable,
  voterOtps,
  invitationCodes,
  categories,
  workflowStages,
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
    const votesMap = votes && typeof votes === "object" ? votes : {};

    // 1. Verify event exists and voting stage is active
    const eventList = await db
      .select()
      .from(events)
      .where(and(eq(events.slug, slug), isNull(events.deletedAt)))
      .limit(1);

    if (eventList.length === 0) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const event = eventList[0];

    // Verify stage status
    const stages = await db
      .select()
      .from(workflowStages)
      .where(eq(workflowStages.eventId, event.id));
    const votingStage = stages.find((s) => s.stageType === "VOTING");
    const isVotingActive = votingStage ? votingStage.status === "ACTIVE" : event.status === "ACTIVE";

    if (!isVotingActive) {
      return NextResponse.json(
        { error: "Voting is not currently active for this event program." },
        { status: 403 }
      );
    }

    const verificationConfig = (event.verificationConfig as any) || {};
    const expectedMethod = verificationConfig.method || "NONE";

    const ballotId = `ballot-${sessionId || Math.random().toString(36).substring(2, 7)}-${Date.now()}`;
    const ipAddress = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "";

    // 2. Perform verification & save ballot in atomic transaction
    const result = await db.transaction(async (tx) => {
      let verifiedEmail: string | null = null;
      let usedInvitationCode: string | null = null;

      if (expectedMethod === "EMAIL_OTP") {
        if (!verificationSession || !verificationSession.email || !verificationSession.otpId) {
          throw new Error("Email verification is required.");
        }

        const otpList = await tx
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
          throw new Error("Verification session invalid or unverified.");
        }

        verifiedEmail = verificationSession.email.trim().toLowerCase();

        // Check double voting by verified email inside transaction
        const existingVoteSession = await tx
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
          throw new Error("You have already cast a ballot for this event.");
        }
      } else if (expectedMethod === "INVITATION_CODE") {
        if (!verificationSession || !verificationSession.code) {
          throw new Error("Invitation code is required.");
        }

        const cleanCode = verificationSession.code.trim().toUpperCase();

        const codeList = await tx
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
          throw new Error("Invitation code is invalid or has already been used.");
        }

        usedInvitationCode = cleanCode;
      } else {
        // NONE: Check double voting by sessionId inside transaction
        const existingVoteSession = await tx
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
          throw new Error("You have already cast a ballot for this event.");
        }
      }

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

      if (newSessionList.length === 0) {
        throw new Error("Failed to record vote session.");
      }

      const voteSessionId = newSessionList[0].id;

      // Fetch active categories
      const eventCategories = await tx
        .select()
        .from(categories)
        .where(and(eq(categories.eventId, event.id), eq(categories.isActive, true)));

      let categoriesVoted = 0;
      let categoriesSkipped = 0;

      for (const cat of eventCategories) {
        const nomineeId = votesMap[cat.id];
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
