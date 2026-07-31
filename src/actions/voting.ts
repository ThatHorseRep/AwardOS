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
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { getOrCreateWorkspaceAction } from "./workspaces";

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
  const workspace = await getOrCreateWorkspaceAction();
  if (!workspace) {
    throw new Error("Unauthorized");
  }

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
  const workspace = await getOrCreateWorkspaceAction();
  if (!workspace) {
    throw new Error("Unauthorized");
  }

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous O,0,I,1
  const insertValues = [];
  const prefix = options?.prefix?.trim().toUpperCase() || "";
  const expiresAt = options?.expiresDays && options.expiresDays > 0
    ? new Date(Date.now() + options.expiresDays * 24 * 60 * 60 * 1000)
    : null;

  for (let i = 0; i < count; i++) {
    let randomPart = "";
    for (let j = 0; j < 6; j++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
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
  const workspace = await getOrCreateWorkspaceAction();
  if (!workspace) {
    throw new Error("Unauthorized");
  }

  return await db
    .select()
    .from(invitationCodes)
    .where(eq(invitationCodes.eventId, eventId))
    .orderBy(desc(invitationCodes.createdAt));
}

export async function revokeInvitationCodeAction(codeId: string) {
  const workspace = await getOrCreateWorkspaceAction();
  if (!workspace) {
    throw new Error("Unauthorized");
  }

  await db
    .update(invitationCodes)
    .set({
      status: "REVOKED",
    })
    .where(eq(invitationCodes.id, codeId));

  return { success: true };
}

// Public OTP: Send Action (generate & print to logs)
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

  // 3. Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry

  // 4. Save to DB
  const otpRecords = await db
    .insert(voterOtps)
    .values({
      eventId,
      email: cleanEmail,
      code,
      expiresAt,
      verified: false,
    })
    .returning({ id: voterOtps.id });

  // 5. DEV OTP LOG to console
  console.log(`\n--- [OTP DEV LOG] ---`);
  console.log(`Sent verification OTP: ${code} to ${cleanEmail}`);
  console.log(`Expires at: ${expiresAt.toLocaleTimeString()}`);
  console.log(`---------------------\n`);

  return {
    success: true,
    otpId: otpRecords[0].id,
  };
}

// Public OTP: Verify Action
export async function verifyEmailOtpAction(eventId: string, email: string, code: string) {
  const cleanEmail = email.trim().toLowerCase();

  const otpList = await db
    .select()
    .from(voterOtps)
    .where(
      and(
        eq(voterOtps.eventId, eventId),
        eq(voterOtps.email, cleanEmail),
        eq(voterOtps.code, code.trim())
      )
    )
    .orderBy(desc(voterOtps.createdAt))
    .limit(1);

  if (otpList.length === 0) {
    throw new Error("Invalid verification code.");
  }

  const otp = otpList[0];

  if (new Date() > new Date(otp.expiresAt)) {
    throw new Error("Verification code has expired.");
  }

  // Mark verified
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
    verificationConfig: (event.verificationConfig as any) || {},
    audienceConfig: (event.audienceConfig as any) || {},
    categories: categoriesWithNominees,
  };
}

export async function verifyInvitationCodeAction(eventId: string, code: string) {
  const cleanCode = code.trim().toUpperCase();

  const codeList = await db
    .select()
    .from(invitationCodes)
    .where(
      and(
        eq(invitationCodes.eventId, eventId),
        eq(invitationCodes.code, cleanCode)
      )
    )
    .limit(1);

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
