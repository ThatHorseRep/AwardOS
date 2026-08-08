import { db } from "@/lib/db";
import { voteSessions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Server-side "already voted" marker for public ballots.
 *
 * The cookie is HTTP-only so page scripts cannot read or forge it, which is what
 * replaces the old localStorage marker. It is never trusted on presence alone:
 * `resolveVotedBallot` ties the value back to a real SUBMITTED vote session, so a
 * stale or hand-crafted Cookie header cannot lock a legitimate voter out forever.
 */
export const VOTED_COOKIE_PREFIX = "awardos_voted_";

export function votedCookieName(slug: string): string {
  return `${VOTED_COOKIE_PREFIX}${slug}`;
}

export const votedCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365, // 1 year
};

/**
 * Frictionless (NONE) mode is the only method that leans on this cookie for
 * deduplication. EMAIL_OTP dedupes on the verified email and INVITATION_CODE on the
 * atomically-claimed code, so enforcing the cookie there would wrongly block a second
 * legitimate voter sharing a device (lab machine, kiosk, family laptop).
 */
export function isCookieEnforcedMethod(method: string | undefined | null): boolean {
  return (method || "NONE") === "NONE";
}

/**
 * Returns the submitted ballot this cookie value refers to, or null when the cookie is
 * absent, malformed, or not backed by a ballot for this event.
 */
export async function resolveVotedBallot(eventId: string, cookieValue: string | undefined) {
  const token = cookieValue?.trim();
  if (!token || token.length > 255) {
    return null;
  }

  const sessionList = await db
    .select({
      id: voteSessions.id,
      sessionToken: voteSessions.sessionToken,
      submittedAt: voteSessions.submittedAt,
    })
    .from(voteSessions)
    .where(
      and(
        eq(voteSessions.eventId, eventId),
        eq(voteSessions.sessionToken, token),
        eq(voteSessions.status, "SUBMITTED")
      )
    )
    .limit(1);

  return sessionList[0] ?? null;
}
