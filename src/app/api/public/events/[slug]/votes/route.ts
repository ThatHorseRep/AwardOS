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
import { randomUUID } from "crypto";
import { submitVotesSchema } from "@/lib/validators";
import { hashIP } from "@/lib/hash";
import { getClientIp } from "@/lib/request-ip";
import {
  votedCookieName,
  votedCookieOptions,
} from "@/lib/voting-cookie";
import { canSubmitBallotAt } from "@/lib/voting-window";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { issueBallotReceipt } from "@/lib/ballot-receipt";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 64 * 1024) return NextResponse.json({ error: "Request payload is too large." }, { status: 413 });
    const body = await request.json();
    const parseResult = submitVotesSchema.safeParse(body);

    if (!parseResult.success) {
      const validationMessage = parseResult.error.issues
        .map((issue) => issue.message)
        .join("; ");
      return NextResponse.json({ error: validationMessage }, { status: 400 });
    }

    const { votes, sessionId, verificationSession } = parseResult.data;
    const sessionToken = sessionId?.trim() || `sess_${randomUUID()}`;
    const ballotId = `ballot-${sessionToken}`;
    const ipAddress = getClientIp(request.headers);
    const userAgent = request.headers.get("user-agent") || "";
    // Deliberately excludes the User-Agent. It is client-supplied, so including
    // it let a voter mint a fresh identity — and a second ballot — by altering a
    // single byte of the header. The IP alone is coarse (it groups a household
    // or an office), which is why the database unique index, not this value, is
    // what actually enforces one-ballot-per-voter.
    const deviceFingerprint = hashIP(ipAddress, slug);
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

    const sharedLimit = await consumeRateLimit(`public-votes:${event.id}`, ipAddress, { limit: 10, windowMs: 5 * 60 * 1000 });
    if (!sharedLimit.allowed) return NextResponse.json({ error: "Too many ballot attempts. Please try again later." }, { status: 429, headers: rateLimitHeaders(sharedLimit) });

    // A private or unlisted event must not accept ballots from someone who
    // merely guessed the slug.
    if (event.visibility === "PRIVATE") {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    // Both gates have to hold. Previously an ACTIVE voting stage was taken as
    // sufficient on its own, which meant a DRAFT, PAUSED, or COMPLETED event
    // still accepted ballots as long as a stage row said ACTIVE.
    if (event.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Voting is not currently open for this event." },
        { status: 403 }
      );
    }

    const stages = await db
      .select()
      .from(workflowStages)
      .where(eq(workflowStages.eventId, event.id));
    const votingStage = stages.find((s) => s.stageType === "VOTING");

    if (votingStage) {
      if (votingStage.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "Voting is not currently open for this event." },
          { status: 403 }
        );
      }

      // startsAt/endsAt were stored and configured by admins but never checked,
      // so a schedule window had no effect on who could vote.
      const now = Date.now();
      if (votingStage.startsAt && now < new Date(votingStage.startsAt).getTime()) {
        return NextResponse.json(
          { error: "Voting has not opened yet for this event." },
          { status: 403 }
        );
      }
      if (votingStage.endsAt && now > new Date(votingStage.endsAt).getTime()) {
        const deadline = new Date(votingStage.endsAt);
        const [startedSession] = await db.select({ startedAt: voteSessions.startedAt }).from(voteSessions).where(and(eq(voteSessions.eventId, event.id), eq(voteSessions.sessionToken, ballotId), eq(voteSessions.status, "IN_PROGRESS"))).limit(1);
        if (!canSubmitBallotAt({ now: new Date(now), startsAt: votingStage.startsAt, endsAt: deadline, startedAt: startedSession?.startedAt ?? null })) return NextResponse.json({ error: "Voting has closed for this event." }, { status: 403 });
      }
    }

    const verificationConfig = (event.verificationConfig as { method?: "NONE" | "EMAIL_OTP" | "INVITATION_CODE" } | null) ?? {};
    const expectedMethod = verificationConfig.method || "NONE";

    // No cookie gate here. The voted cookie is now scoped to /e/<slug>, so the
    // browser does not attach it to this API path and a check here would never
    // fire. Nothing is lost: the partial unique index on
    // (event_id, device_fingerprint) is what actually enforces one ballot per
    // voter, and it holds even against concurrent submissions, which a cookie
    // read never could. The cookie's remaining job is presentational — showing a
    // returning voter the "already voted" state on the ballot page itself.

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

    // An entirely empty ballot expresses no preference, yet it still consumed
    // the voter's one allowed submission — burning their invitation code or
    // fingerprint and locking them out of voting for real.
    if (votes.every((vote) => !vote.nomineeId)) {
      return NextResponse.json(
        { error: "Select at least one nominee before submitting your ballot." },
        { status: 400 }
      );
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
              eq(voterOtps.verified, true),
              // Expiry was checked when the code was verified but not again
              // here, so a verified otpId stayed valid indefinitely — a
              // permanent bearer token for that voter's ballot.
              gt(voterOtps.expiresAt, new Date())
            )
          )
          .limit(1);

        if (otpList.length === 0) {
          throw new Error("Verification session invalid or expired.");
        }

        verifiedEmail = verificationSession.email.trim().toLowerCase();

        // Consume it. Nothing previously invalidated a used OTP, so the same
        // one could be replayed. The unique index below is the real guard, but
        // a spent credential should not stay spendable.
        await tx
          .delete(voterOtps)
          .where(eq(voterOtps.id, verificationSession.otpId));

        // Kept as a fast, friendly rejection ahead of the database constraint;
        // the unique index on (event_id, verified_email) is what makes it safe
        // under concurrency.
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
            eq(voteSessions.deviceFingerprint, deviceFingerprint),
            eq(voteSessions.status, "SUBMITTED")
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

      const existingStarted = await tx.select({ id: voteSessions.id }).from(voteSessions).where(and(eq(voteSessions.eventId, event.id), eq(voteSessions.sessionToken, ballotId), eq(voteSessions.status, "IN_PROGRESS"))).limit(1);
      const sessionValues = {
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
        } as const;
      const newSessionList = existingStarted.length
        ? await tx.update(voteSessions).set(sessionValues).where(eq(voteSessions.id, existingStarted[0].id)).returning({ id: voteSessions.id })
        : await tx.insert(voteSessions).values(sessionValues).returning({ id: voteSessions.id });

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

    const receipt = issueBallotReceipt({
      eventId: event.id,
      sessionId: result.voteSessionId,
      issuedAt: new Date().toISOString(),
    });
    const successResponse = NextResponse.json({
      success: true,
      message: "Ballot cast successfully.",
      receipt,
      voteCount: result.categoriesVoted,
      timestamp: new Date().toISOString(),
    });

    // Server-set HTTP-only cookie: survives localStorage clears and is unreadable and
    // unforgeable from page scripts. Value is the ballot receipt so it can be validated
    // against vote_sessions on later requests.
    successResponse.cookies.set(votedCookieName(slug), ballotId, votedCookieOptions(slug));

    return successResponse;
  } catch (error: unknown) {
    // The unique indexes on vote_sessions are what actually stop a double
    // ballot, including two genuinely concurrent ones. Reaching here with 23505
    // means the constraint did its job, so this is a conflict, not a fault.
    const pgCode = (error as { code?: string })?.code;
    if (pgCode === "23505") {
      const constraint = (error as { constraint_name?: string })?.constraint_name ?? "";
      const message = constraint.includes("event_email")
        ? "A ballot has already been submitted with this email address."
        : constraint.includes("event_fingerprint")
        ? "A ballot from this device has already been submitted for this event."
        : "You have already cast a ballot for this event.";
      return NextResponse.json({ error: message }, { status: 409 });
    }

    const message =
      error instanceof Error ? error.message : "Unable to submit ballot.";

    // Rejections raised inside the transaction are voter-facing rules, not
    // server faults, and were previously all reported as HTTP 500 — which read
    // to the voter as "the site is broken" rather than "you already voted".
    const isConflict = /already/i.test(message);
    const isRateLimited = /too many/i.test(message);
    const isRuleViolation =
      /required|invalid|expired|not eligible|at least one|no longer/i.test(message);

    if (isConflict) return NextResponse.json({ error: message }, { status: 409 });
    if (isRateLimited) return NextResponse.json({ error: message }, { status: 429 });
    if (isRuleViolation) return NextResponse.json({ error: message }, { status: 400 });

    console.error("Submit Ballot error:", error);
    return NextResponse.json(
      { error: "Internal server error submitting ballot." },
      { status: 500 }
    );
  }
}
