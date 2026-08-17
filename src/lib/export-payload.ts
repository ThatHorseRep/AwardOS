import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, categories, nominees, nominations, officialResults, votes, voteSessions } from "@/lib/db/schema";

export type ExportType = "NOMINATIONS_RAW" | "NOMINATIONS_CLEAN" | "VOTES_RAW" | "OFFICIAL_RESULTS" | "ANALYTICS" | "FULL_REPORT";

export async function estimateExportRows(eventId: string, type: ExportType): Promise<number> {
  if (type === "ANALYTICS") return 1;
  if (type === "FULL_REPORT") return (await db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(eq(auditLogs.eventId, eventId)))[0]?.count ?? 0;
  if (type === "NOMINATIONS_RAW") return (await db.select({ count: sql<number>`count(*)::int` }).from(nominations).where(eq(nominations.eventId, eventId)))[0]?.count ?? 0;
  if (type === "VOTES_RAW") return (await db.select({ count: sql<number>`count(${votes.id})::int` }).from(votes).innerJoin(voteSessions, eq(votes.voteSessionId, voteSessions.id)).where(and(eq(votes.eventId, eventId), eq(voteSessions.status, "SUBMITTED"))))[0]?.count ?? 0;
  return (await db.select({ count: sql<number>`count(*)::int` }).from(nominees).where(eq(nominees.eventId, eventId)))[0]?.count ?? 0;
}

export async function buildExportPayload(eventId: string, type: ExportType, includeSensitiveFields: boolean): Promise<Array<Record<string, unknown>>> {
  if (type === "NOMINATIONS_RAW") {
    return db.select({ Nomination: nominations.nomineeText, Category: categories.name, Session: nominations.sessionId, SubmissionNumber: nominations.submissionNumber, Latest: nominations.isLatest, SubmittedAt: nominations.createdAt }).from(nominations).innerJoin(categories, eq(nominations.categoryId, categories.id)).where(eq(nominations.eventId, eventId)).orderBy(desc(nominations.createdAt));
  }
  if (type === "NOMINATIONS_CLEAN") {
    return db.select({ Category: categories.name, Nominee: nominees.name, Biography: nominees.bio, Status: nominees.status, Source: nominees.source, NominationCount: nominees.nominationCount }).from(nominees).innerJoin(categories, eq(nominees.categoryId, categories.id)).where(eq(nominees.eventId, eventId)).orderBy(categories.displayOrder, nominees.displayOrder);
  }
  if (type === "VOTES_RAW") {
    const rows = await db.select({ BallotId: voteSessions.id, Category: categories.name, Nominee: nominees.name, Skipped: votes.skipped, VerificationMethod: voteSessions.verificationMethod, VerifiedEmail: voteSessions.verifiedEmail, InvitationCode: voteSessions.invitationCode, DeviceFingerprint: voteSessions.deviceFingerprint, IPAddress: voteSessions.ipAddress, Status: voteSessions.status, SubmittedAt: voteSessions.submittedAt }).from(votes).innerJoin(voteSessions, eq(votes.voteSessionId, voteSessions.id)).innerJoin(categories, eq(votes.categoryId, categories.id)).leftJoin(nominees, eq(votes.nomineeId, nominees.id)).where(and(eq(votes.eventId, eventId), eq(voteSessions.status, "SUBMITTED"))).orderBy(desc(voteSessions.submittedAt));
    return includeSensitiveFields ? rows : rows.map((row) => ({ BallotId: row.BallotId, Category: row.Category, Nominee: row.Nominee, Skipped: row.Skipped, VerificationMethod: row.VerificationMethod, Status: row.Status, SubmittedAt: row.SubmittedAt }));
  }
  if (type === "OFFICIAL_RESULTS") {
    return db.select({ Category: categories.name, Nominee: nominees.name, RawVotes: officialResults.rawVoteCount, OfficialVotes: officialResults.adjustedVoteCount, FinalRank: officialResults.finalRank, OverrideRank: officialResults.overrideRank, OverrideReason: officialResults.overrideReason, Winner: officialResults.isWinner, Disqualified: officialResults.isDisqualified }).from(officialResults).innerJoin(categories, eq(officialResults.categoryId, categories.id)).innerJoin(nominees, eq(officialResults.nomineeId, nominees.id)).where(eq(officialResults.eventId, eventId)).orderBy(categories.displayOrder, officialResults.finalRank);
  }
  if (type === "ANALYTICS") {
    const [nominationCount, nomineeCount, ballotCount, voteCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(nominations).where(eq(nominations.eventId, eventId)),
      db.select({ count: sql<number>`count(*)::int` }).from(nominees).where(eq(nominees.eventId, eventId)),
      db.select({ count: sql<number>`count(*)::int` }).from(voteSessions).where(and(eq(voteSessions.eventId, eventId), eq(voteSessions.status, "SUBMITTED"))),
      db.select({ count: sql<number>`count(*)::int` }).from(votes).where(eq(votes.eventId, eventId)),
    ]);
    return [{ RawNominations: nominationCount[0]?.count ?? 0, CleanedNominees: nomineeCount[0]?.count ?? 0, SubmittedBallots: ballotCount[0]?.count ?? 0, BallotSelections: voteCount[0]?.count ?? 0 }];
  }
  const logs = await db.select().from(auditLogs).where(eq(auditLogs.eventId, eventId)).orderBy(desc(auditLogs.createdAt));
  return logs.map((log) => ({ Action: log.action, TargetType: log.targetType, TargetId: log.targetId, ...(includeSensitiveFields ? { IPAddress: log.ipAddress } : {}), Timestamp: log.createdAt.toISOString() }));
}
