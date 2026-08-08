"use server";

import { db } from "@/lib/db";
import {
  events,
  invitationCodes,
  voterOtps,
  categories,
  nominees,
  voteSessions,
} from "@/lib/db/schema";
import { eq, and, desc, sql, isNull, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getOrCreateWorkspaceAction } from "./workspaces";
import { requireWorkspaceRole, requireEventAccess, EVENT_ADMINS, WORKSPACE_ADMINS } from "./_rbac";
import {
  votedCookieName,
  isCookieEnforcedMethod,
  resolveVotedBallot,
} from "@/lib/voting-cookie";
import {
  generateOtpCode,
  hashOtpCode,
  otpHashMatches,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
} from "@/lib/otp";
import { escapeXml } from "@/lib/sanitize";
import { INVITATION_CODE_LENGTH } from "@/lib/constants";
import { randomInt } from "crypto";

export async function updateEventSettingsAction(
  eventId: string,
  config: {
    visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
    liveResultsMode: "HIDDEN" | "RANKINGS" | "PERCENTAGES" | "VOTE_COUNTS" | "FULL_LEADERBOARD";
    verificationMethod: "NONE" | "EMAIL_OTP" | "INVITATION_CODE";
    whitelistDomains: string[];
    whitelistEmails: string[];
  }
) {
  // Verification method and whitelists gate who may vote — admins only.
  const { workspace } = await requireWorkspaceRole(WORKSPACE_ADMINS);

  await db
    .update(events)
    .set({
      visibility: config.visibility,
      liveResultsMode: config.liveResultsMode,
      verificationConfig: {
        method: config.verificationMethod,
      },
      audienceConfig: {
        whitelistDomains: config.whitelistDomains,
        whitelistEmails: config.whitelistEmails,
      },
      updatedAt: new Date(),
    })
    .where(and(eq(events.id, eventId), eq(events.workspaceId, workspace.id)));

  return { success: true };
}

export async function generateInvitationCodesAction(
  eventId: string,
  count: number,
  options?: { prefix?: string; expiresDays?: number }
) {
  await requireEventAccess(eventId, EVENT_ADMINS);

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous O,0,I,1
  const insertValues = [];
  const prefix = options?.prefix?.trim().toUpperCase() || "";
  const expiresAt = options?.expiresDays && options.expiresDays > 0
    ? new Date(Date.now() + options.expiresDays * 24 * 60 * 60 * 1000)
    : null;

  for (let i = 0; i < count; i++) {
    // 10 characters of a 32-character alphabet is ~50 bits, up from ~30 at the
    // previous 6. And randomInt is the CSPRNG: with Math.random() an attacker
    // who sees a handful of issued codes can recover the generator state and
    // derive the rest, which for a bearer ballot credential is fatal.
    let randomPart = "";
    for (let j = 0; j < INVITATION_CODE_LENGTH; j++) {
      randomPart += chars.charAt(randomInt(0, chars.length));
    }
    const code = prefix ? `${prefix}-${randomPart}` : randomPart;

    insertValues.push({
      eventId,
      code,
      status: "UNUSED" as const,
      expiresAt,
      createdAt: new Date(),
    });
  }

  await db.insert(invitationCodes).values(insertValues);
  return { success: true, generatedCount: count };
}

export async function getInvitationCodesAction(eventId: string) {
  // Codes are bearer credentials for casting a ballot — admins only.
  await requireEventAccess(eventId, EVENT_ADMINS);

  return await db
    .select()
    .from(invitationCodes)
    .where(eq(invitationCodes.eventId, eventId))
    .orderBy(desc(invitationCodes.createdAt));
}

export async function revokeInvitationCodeAction(codeId: string) {
  // Resolve the owning event from the code before authorizing — otherwise any
  // event admin could revoke ballot credentials for another workspace's event.
  const [owner] = await db
    .select({ eventId: invitationCodes.eventId })
    .from(invitationCodes)
    .where(eq(invitationCodes.id, codeId))
    .limit(1);

  if (!owner) {
    throw new Error("Invitation code not found");
  }

  await requireEventAccess(owner.eventId, EVENT_ADMINS);

  await db
    .update(invitationCodes)
    .set({
      status: "REVOKED",
    })
    .where(eq(invitationCodes.id, codeId));

  return { success: true };
}

// Public OTP: Send Action
export async function sendEmailOtpAction(eventId: string, email: string) {
  const cleanEmail = email.trim().toLowerCase();
  
  // 1. Get event configuration
  const eventList = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (eventList.length === 0) {
    throw new Error("Event not found");
  }

  const event = eventList[0];
  const audience = (event.audienceConfig as any) || {};
  const whitelistDomains = audience.whitelistDomains || [];
  const whitelistEmails = audience.whitelistEmails || [];

  // 2. Validate Whitelist (if domain or email is set)
  if (whitelistDomains.length > 0 || whitelistEmails.length > 0) {
    const domain = cleanEmail.split("@")[1];
    const isDomainAllowed = whitelistDomains.some((d: string) => d.toLowerCase().trim() === domain);
    const isEmailAllowed = whitelistEmails.some((e: string) => e.toLowerCase().trim() === cleanEmail);

    if (!isDomainAllowed && !isEmailAllowed) {
      throw new Error("This email is not eligible to vote in this event.");
    }
  }

  // 3. Rate limit: max 3 active (non-expired) OTPs per email per event
  const recentOtps = await db
    .select({ id: voterOtps.id })
    .from(voterOtps)
    .where(
      and(
        eq(voterOtps.eventId, eventId),
        eq(voterOtps.email, cleanEmail),
        gt(voterOtps.expiresAt, new Date())
      )
    );

  if (recentOtps.length >= 3) {
    throw new Error("Too many verification attempts. Please wait a few minutes before requesting a new code.");
  }

  // 4. Generate code with the CSPRNG and store only its digest
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  const otpRecords = await db
    .insert(voterOtps)
    .values({
      eventId,
      email: cleanEmail,
      codeHash: hashOtpCode(code),
      expiresAt,
      verified: false,
    })
    .returning({ id: voterOtps.id });

  // 5. Deliver it
  const resendApiKey = process.env.RESEND_API_KEY;

  if (resendApiKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(resendApiKey);
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "AwardOS <onboarding@resend.dev>",
        to: cleanEmail,
        // The code is deliberately not in the subject: subject lines appear in
        // lock-screen notifications, mail-client previews and relay logs.
        subject: `Your ${event.name} voter access code`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #1e293b; font-size: 20px; margin-bottom: 8px;">Your Voter Access Code</h2>
            <p style="color: #64748b; font-size: 14px; margin-bottom: 24px;">Use the code below to verify your identity and cast your ballot for <strong>${escapeXml(event.name)}</strong>.</p>
            <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1e293b; font-family: monospace;">${code}</span>
            </div>
            <p style="color: #94a3b8; font-size: 12px;">This code expires in 10 minutes. If you did not request this, please ignore this email.</p>
          </div>
        `,
      });
    } catch (emailErr) {
      // Previously this was swallowed and the action still returned success, so
      // the voter advanced to the code screen for a code that never arrived.
      // Drop the unusable code rather than leaving it live.
      await db.delete(voterOtps).where(eq(voterOtps.id, otpRecords[0].id));
      console.error("[OTP] Email send failed:", (emailErr as Error)?.message);
      throw new Error(
        "We could not send your verification code. Please try again in a moment."
      );
    }
  } else if (process.env.NODE_ENV === "production") {
    // Failing loudly beats a voting page that silently cannot verify anyone.
    await db.delete(voterOtps).where(eq(voterOtps.id, otpRecords[0].id));
    throw new Error(
      "Email verification is unavailable for this event. Please contact the organizer."
    );
  } else {
    console.log(
      `[DEV OTP] ${cleanEmail} -> ${code} (expires ${expiresAt.toLocaleTimeString()})`
    );
  }

  return {
    success: true,
    otpId: otpRecords[0].id,
  };
}

// Public OTP: Verify Action
export async function verifyEmailOtpAction(eventId: string, email: string, code: string) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();

  // Fetch by identity only. The code is compared in constant time below, since
  // matching on it in SQL would leak validity through query behaviour and makes
  // an attempt counter impossible (a wrong guess would return no row at all).
  const otpList = await db
    .select()
    .from(voterOtps)
    .where(
      and(
        eq(voterOtps.eventId, eventId),
        eq(voterOtps.email, cleanEmail),
        eq(voterOtps.verified, false),
        gt(voterOtps.expiresAt, new Date())
      )
    )
    .orderBy(desc(voterOtps.createdAt))
    .limit(1);

  // Deliberately identical to a wrong code: distinguishing "no code issued" from
  // "wrong code" tells an attacker which addresses are eligible to vote.
  if (otpList.length === 0) {
    throw new Error("Invalid or expired verification code.");
  }

  const otp = otpList[0];

  // A 6-digit code is 10^6 possibilities — searchable in minutes without this.
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    throw new Error(
      "Too many incorrect attempts. Please request a new verification code."
    );
  }

  if (!otpHashMatches(hashOtpCode(cleanCode), otp.codeHash)) {
    await db
      .update(voterOtps)
      .set({ attempts: otp.attempts + 1 })
      .where(eq(voterOtps.id, otp.id));

    throw new Error("Invalid or expired verification code.");
  }

  await db
    .update(voterOtps)
    .set({ verified: true })
    .where(eq(voterOtps.id, otp.id));

  return {
    success: true,
    otpId: otp.id,
  };
}

export async function getPublicBallotDetailsAction(slug: string) {
  const eventList = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, slug), isNull(events.deletedAt)))
    .limit(1);

  if (eventList.length === 0) {
    return null;
  }

  const event = eventList[0];
  const verificationConfig = (event.verificationConfig as any) || {};

  // Server-side "already voted" check. Reads the HTTP-only cookie the votes route set
  // (page scripts cannot see or fake it) and confirms it maps to a real submitted
  // ballot before gating the UI, so a stale cookie never blocks a legitimate voter.
  let hasVoted = false;
  if (isCookieEnforcedMethod(verificationConfig.method)) {
    const cookieStore = await cookies();
    const votedCookie = cookieStore.get(votedCookieName(slug))?.value;
    if (votedCookie) {
      hasVoted = (await resolveVotedBallot(event.id, votedCookie)) !== null;
    }
  }

  // Fetch active nominees directly (write-sync is done at nomination submission time)
  // Do NOT call ensureNomineesForRawNominationsAction here - it's a write op in a read path

  // Fetch active categories
  const eventCategories = await db
    .select()
    .from(categories)
    .where(and(eq(categories.eventId, event.id), eq(categories.isActive, true)))
    .orderBy(categories.displayOrder);

  // For each category, fetch active nominees
  const categoriesWithNominees = [];
  for (const cat of eventCategories) {
    const nomineeList = await db
      .select()
      .from(nominees)
      .where(and(eq(nominees.categoryId, cat.id), eq(nominees.status, "ACTIVE")))
      .orderBy(nominees.displayOrder);

    categoriesWithNominees.push({
      ...cat,
      nominees: nomineeList,
    });
  }

  return {
    id: event.id,
    name: event.name,
    slug: event.slug,
    status: event.status,
    description: event.description,
    verificationConfig,
    audienceConfig: (event.audienceConfig as any) || {},
    categories: categoriesWithNominees,
    hasVoted,
  };
}

// Pre-ballot check only. FOR UPDATE cannot reserve the code across the later ballot
// request — the lock releases when this transaction commits — but it does serialise
// against an in-flight claim, so this never reports a code as available while another
// submission is part-way through claiming it. The authoritative gate is the FOR UPDATE
// claim inside the ballot submission transaction.
export async function verifyInvitationCodeAction(eventId: string, code: string) {
  const cleanCode = code.trim().toUpperCase();

  return await db.transaction(async (tx) => {
    const codeList = await tx
      .select()
      .from(invitationCodes)
      .where(
        and(
          eq(invitationCodes.eventId, eventId),
          eq(invitationCodes.code, cleanCode)
        )
      )
      .limit(1)
      .for("update");

    if (codeList.length === 0) {
      throw new Error("Invalid invitation code.");
    }

    const invitation = codeList[0];

    if (invitation.status !== "UNUSED") {
      throw new Error(`This invitation code has already been ${invitation.status.toLowerCase()}.`);
    }

    if (invitation.expiresAt && new Date() > new Date(invitation.expiresAt)) {
      throw new Error("This invitation code has expired.");
    }

    return { success: true };
  });
}

export async function verifyBallotReceiptAction(slug: string, receiptCode: string) {
  const cleanCode = receiptCode.trim();

  // 1. Get event
  const eventList = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, slug), isNull(events.deletedAt)))
    .limit(1);

  if (eventList.length === 0) {
    throw new Error("Event not found");
  }

  const event = eventList[0];

  // 2. Query vote session by token or session ID
  const sessionList = await db
    .select()
    .from(voteSessions)
    .where(
      and(
        eq(voteSessions.eventId, event.id),
        sql`(${voteSessions.sessionToken} = ${cleanCode} OR ${voteSessions.id}::text = ${cleanCode})`
      )
    )
    .limit(1);

  if (sessionList.length === 0) {
    return { valid: false, message: "No matching ballot receipt recorded." };
  }

  const sess = sessionList[0];

  return {
    valid: true,
    eventName: event.name,
    receiptCode: sess.sessionToken,
    status: sess.status,
    submittedAt: sess.submittedAt ? sess.submittedAt.toISOString() : null,
    categoriesVoted: sess.categoriesVoted || 0,
    verificationMethod: sess.verificationMethod,
  };
}
