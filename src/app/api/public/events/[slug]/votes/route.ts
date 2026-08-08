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
  nominees,
} from "@/lib/db/schema";
import { eq, and, isNull, inArray, gt } from "drizzle-orm";
import { submitVotesSchema } from "@/lib/validators";
import { hashIP } from "@/lib/hash";
import {
  votedCookieName,
  votedCookieOptions,
  isCookieEnforcedMethod,
  resolveVotedBallot,
} from "@/lib/voting-cookie";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const votedCookie = request.cookies.get(votedCookieName(slug))?.value;

    const body = await request.json();
    const parseResult = submitVotesSchema.safeParse(body);

    if (!parseResult.success) {
      const validationMessage = parseResult.error.issues
        .map((issue) => issue.message)
        .join("; ");
      return NextResponse.json({ error: validationMessage }, { status: 400 });
    }

    const { votes, sessionId, verificationSession } = parseResult.data;
    const sessionToken = sessionId?.trim() || `sess_${Math.random().toString(36).substring(2)}_${Date.now()}`;
    const ballotId = `ballot-${sessionToken}`;
    const forwardedFor = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "";
    const ipAddress = forwardedFor.split(",")[0].trim() || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "";
    const deviceFingerprint = hashIP(`${ipAddress}|${userAgent}`, slug);
    const providedMethod = (verificationSession?.method || "NONE") as string;

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

    // HTTP-only cookie gate (frictionless mode): the cookie is only honoured once it
    // resolves to a real submitted ballot for this event, so a stale or hand-crafted
    // Cookie header cannot permanently lock a legitimate voter out.
    if (votedCookie && isCookieEnforcedMethod(expectedMethod)) {
      const priorBallot = await resolveVotedBallot(event.id, votedCookie);
      if (priorBallot) {
        return NextResponse.json(
          { error: "You have already cast a ballot for this event." },
          { status: 409 }
        );
      }
    }

    if (verificationSession && expectedMethod !== providedMethod) {
      return NextResponse.json(
        { error: "Verification method does not match this event's configuration." },
        { status: 400 }
      );
    }

    // Validate ballot contents against the active event categories
    const eventCategories = await db
      .select()
      .from(categories)
      .where(and(eq(categories.eventId, event.id), eq(categories.isActive, true)));

    const categoryIds = eventCategories.map((cat) => cat.id);
    const voteCategorySet = new Set(votes.map((vote) => vote.categoryId));

    if (voteCategorySet.size !== votes.length) {
      return NextResponse.json({ error: "Duplicate category entries are not allowed." }, { status: 400 });
    }

    if (!votes.every((vote) => categoryIds.includes(vote.categoryId))) {
      return NextResponse.json({ error: "One or more ballot selections are invalid for this event." }, { status: 400 });
    }

    if (votes.length !== categoryIds.length) {
      return NextResponse.json({ error: "Ballot must include one entry for each active category." }, { status: 400 });
    }

    const missingCategories = categoryIds.filter((categoryId) => !voteCategorySet.has(categoryId));
    if (missingCategories.length > 0) {
      return NextResponse.json({ error: "Ballot entries must include every active category." }, { status: 400 });
    }

    for (const vote of votes) {
      if (vote.nomineeId === null && vote.skipped === false) {
        return NextResponse.json({ error: "Skipped ballots must be marked as skipped." }, { status: 400 });
      }
      if (vote.nomineeId !== null && vote.skipped === true) {
        return NextResponse.json({ error: "Selected nominees cannot be marked as skipped." }, { status: 400 });
      }
    }

    const selectedNomineeIds = votes.filter((vote) => vote.nomineeId).map((vote) => vote.nomineeId as string);
    let nomineeRecords: Array<{ id: string; categoryId: string; status: string }> = [];

    if (selectedNomineeIds.length > 0) {
      nomineeRecords = await db
        .select({ id: nominees.id, categoryId: nominees.categoryId, status: nominees.status })
        .from(nominees)
        .where(
          and(
            eq(nominees.eventId, event.id),
            inArray(nominees.id, selectedNomineeIds)
          )
        );

      const validNomineeIds = new Set(nomineeRecords.map((nom) => nom.id));

      for (const vote of votes) {
        if (vote.nomineeId !== null) {
          if (!validNomineeIds.has(vote.nomineeId)) {
            return NextResponse.json({ error: "One or more selected nominees are invalid." }, { status: 400 });
          }
          const nominee = nomineeRecords.find((nom) => nom.id === vote.nomineeId);
          if (!nominee || nominee.categoryId !== vote.categoryId || nominee.status !== "ACTIVE") {
            return NextResponse.json({ error: "Invalid nominee selection for category." }, { status: 400 });
          }
        }
      }
    }

    const result = await db.transaction(async (tx) => {
      let verifiedEmail: string | null = null;
      let usedInvitationCode: string | null = null;
      let claimedInvitationId: string | null = null;

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

        // SELECT ... FOR UPDATE takes a row-level write lock, so a second concurrent
        // submission with the same code blocks here until this transaction ends. On
        // commit it re-reads status as USED and is rejected; on rollback the row is
        // released still UNUSED, so a failed ballot never burns the code.
        const codeList = await tx
          .select({
            id: invitationCodes.id,
            status: invitationCodes.status,
            expiresAt: invitationCodes.expiresAt,
          })
          .from(invitationCodes)
          .where(
            and(
              eq(invitationCodes.code, cleanCode),
              eq(invitationCodes.eventId, event.id)
            )
          )
          .limit(1)
          .for("update");

        if (codeList.length === 0) {
          throw new Error("Invitation code is invalid.");
        }

        const invitation = codeList[0];

        if (invitation.status !== "UNUSED") {
          throw new Error(
            `This invitation code has already been ${invitation.status.toLowerCase()}.`
          );
        }

        // Expiry is enforced here, not just in the advisory pre-ballot check: the code
        // can lapse between verifying it and submitting the ballot.
        if (invitation.expiresAt && new Date() > new Date(invitation.expiresAt)) {
          throw new Error("This invitation code has expired.");
        }

        await tx
          .update(invitationCodes)
          .set({ status: "USED", usedAt: new Date() })
          .where(eq(invitationCodes.id, invitation.id));

        usedInvitationCode = cleanCode;
        claimedInvitationId = invitation.id;
      } else {
        const recentIpSubmissions = await tx
        .select()
        .from(voteSessions)
        .where(
          and(
            eq(voteSessions.eventId, event.id),
            eq(voteSessions.ipAddress, ipAddress),
            gt(voteSessions.submittedAt, new Date(Date.now() - 5 * 60 * 1000))
          )
        );

      if (recentIpSubmissions.length >= 3) {
        throw new Error("Too many ballot submissions from this network. Please wait a few minutes before trying again.");
      }

      const existingDeviceSession = await tx
        .select()
        .from(voteSessions)
        .where(
          and(
            eq(voteSessions.eventId, event.id),
            eq(voteSessions.deviceFingerprint, deviceFingerprint)
          )
        )
        .limit(1);

      if (existingDeviceSession.length > 0) {
        throw new Error("A ballot from this device has already been submitted for this event.");
      }

      const existingVoteSession = await tx
          .select()
          .from(voteSessions)
          .where(
            and(
              eq(voteSessions.eventId, event.id),
              eq(voteSessions.sessionToken, ballotId)
            )
          )
          .limit(1);

        if (existingVoteSession.length > 0) {
          throw new Error("You have already cast a ballot for this event.");
        }
      }

      const newSessionList = await tx
        .insert(voteSessions)
        .values({
          eventId: event.id,
          sessionToken: ballotId,
          deviceFingerprint,
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

      let categoriesVoted = 0;
      let categoriesSkipped = 0;

      for (const vote of votes) {
        if (vote.nomineeId) {
          categoriesVoted++;
          await tx.insert(votesTable).values({
            voteSessionId,
            eventId: event.id,
            categoryId: vote.categoryId,
            nomineeId: vote.nomineeId,
            skipped: false,
          });
        } else {
          categoriesSkipped++;
          await tx.insert(votesTable).values({
            voteSessionId,
            eventId: event.id,
            categoryId: vote.categoryId,
            nomineeId: null,
            skipped: true,
          });
        }
      }

      await tx
        .update(voteSessions)
        .set({
          categoriesVoted,
          categoriesSkipped,
        })
        .where(eq(voteSessions.id, voteSessionId));

      if (claimedInvitationId) {
        // Status was already set to USED under the row lock above; this only back-links
        // the ballot. Keyed on the locked row's id so it cannot touch another event's code.
        await tx
          .update(invitationCodes)
          .set({
            usedBySession: voteSessionId,
          })
          .where(eq(invitationCodes.id, claimedInvitationId));
      }

      return { voteSessionId, categoriesVoted };
    });

    const successResponse = NextResponse.json({
      success: true,
      message: "Ballot cast successfully!",
      ballotId,
      voteCount: result.categoriesVoted,
      timestamp: new Date().toISOString(),
    });

    // Server-set HTTP-only cookie: survives localStorage clears and is unreadable and
    // unforgeable from page scripts. Value is the ballot receipt so it can be validated
    // against vote_sessions on later requests.
    successResponse.cookies.set(votedCookieName(slug), ballotId, votedCookieOptions);

    return successResponse;
  } catch (error: any) {
    console.error("Submit Ballot error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error submitting ballot." },
      { status: 500 }
    );
  }
}
