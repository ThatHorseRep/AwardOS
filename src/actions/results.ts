"use server";

import { db } from "@/lib/db";
import { archiveConfigs, auditLogs, events, eventBranding, categories, nominees, votes, voteSessions, voterOtps, invitationCodes, specialAwards, officialResults, resultActions } from "@/lib/db/schema";
import { eq, and, sql, isNull, desc } from "drizzle-orm";
import { requireEventAccess, requireWorkspaceRole, RESULTS_MANAGERS, EVENT_ADMINS, ALL_MEMBERS } from "./_rbac";
import { discloseCandidate } from "@/lib/results/disclosure";
import { resultPercentage } from "@/lib/results/math";

/**
 * Tabulation core. Takes an event id that has ALREADY been authorized — either
 * by an exported action that called `requireEventAccess`, or by resolving a
 * public slug. Never export this: it applies no access control of its own.
 */
async function tabulateEventResults(eventId: string) {
  // 1. Fetch event config
  const eventList = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (eventList.length === 0) {
    throw new Error("Event not found");
  }

  const event = eventList[0];

  // 2. Fetch categories
  const eventCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.eventId, eventId))
    .orderBy(categories.displayOrder);

  const categoryResults = [];

  for (const cat of eventCategories) {
    // 3. Fetch nominees in category
    const nomineeList = await db
      .select()
      .from(nominees)
      .where(eq(nominees.categoryId, cat.id))
      .orderBy(nominees.displayOrder);

    let totalCategoryVotes = 0;
    const candidates = [];

    for (const nom of nomineeList) {
      // Count votes where session is SUBMITTED and NOT INVALIDATED
      const countResult = await db
        .select({
          count: sql<number>`count(${votes.id})::int`,
        })
        .from(votes)
        .innerJoin(voteSessions, eq(votes.voteSessionId, voteSessions.id))
        .where(
          and(
            eq(votes.nomineeId, nom.id),
            eq(voteSessions.status, "SUBMITTED")
          )
        );

      const votesCount = countResult[0]?.count || 0;
      totalCategoryVotes += votesCount;

      // Fetch judge score if entered
      const officialRes = await db
        .select()
        .from(officialResults)
        .where(and(eq(officialResults.eventId, eventId), eq(officialResults.nomineeId, nom.id)))
        .limit(1);

      const official = officialRes[0] ?? null;

      candidates.push({
        id: nom.id,
        name: nom.name,
        bio: nom.bio,
        votes: official?.adjustedVoteCount ?? votesCount,
        rawVotes: votesCount,
        officialResultId: official?.id ?? null,
        overrideRank: official?.overrideRank ?? null,
        overrideReason: official?.overrideReason ?? null,
        status: official?.isDisqualified ? "DISQUALIFIED" : nom.status,
      });
    }

    // Sort active candidates by vote totals descending
    const activeCandidates = candidates.filter((c) => c.status !== "MERGED" && c.status !== "REMOVED");
    activeCandidates.sort((a, b) =>
      (a.overrideRank ?? Number.MAX_SAFE_INTEGER) -
        (b.overrideRank ?? Number.MAX_SAFE_INTEGER) || b.votes - a.votes,
    );

    // Compute ranks and percentages from the same displayed vote totals. Raw
    // selections remain available separately for audit/export purposes.
    const displayedTotal = activeCandidates.reduce((sum, candidate) => sum + candidate.votes, 0);
    const rankedWinners = activeCandidates.map((cand, idx) => {
      const percentageVal = resultPercentage(cand.votes, displayedTotal);
      const percent = percentageVal.toFixed(1) + "%";

      return {
        ...cand,
        rank: idx + 1,
        percent,
        percentNum: percentageVal,
        badgeStatus: idx === 0 ? "WINNER" : idx === 1 ? "RUNNER_UP" : "FINALIST",
      };
    });

    categoryResults.push({
      id: cat.id,
      categoryName: cat.name,
      totalVotes: displayedTotal,
      rawTotalVotes: totalCategoryVotes,
      winners: rankedWinners,
    });
  }

  return {
    id: event.id,
    eventId: event.id,
    name: event.name,
    slug: event.slug,
    liveResultsMode: event.liveResultsMode,
    categoriesResults: categoryResults,
  };
}

async function snapshotOfficialResults(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  eventId: string,
) {
  const nomineeRows = await tx
    .select({ id: nominees.id, categoryId: nominees.categoryId, status: nominees.status })
    .from(nominees)
    .where(eq(nominees.eventId, eventId));
  const counts = await tx
    .select({ nomineeId: votes.nomineeId, count: sql<number>`count(${votes.id})::int` })
    .from(votes)
    .innerJoin(voteSessions, eq(votes.voteSessionId, voteSessions.id))
    .where(and(eq(votes.eventId, eventId), eq(voteSessions.status, "SUBMITTED")))
    .groupBy(votes.nomineeId);
  const countByNominee = new Map(counts.map((row) => [row.nomineeId, row.count]));

  for (const categoryId of new Set(nomineeRows.map((row) => row.categoryId))) {
    const ranked = nomineeRows
      .filter((row) => row.categoryId === categoryId)
      .sort((a, b) => (countByNominee.get(b.id) ?? 0) - (countByNominee.get(a.id) ?? 0));
    for (const [index, nominee] of ranked.entries()) {
      const rawVoteCount = countByNominee.get(nominee.id) ?? 0;
      await tx
        .insert(officialResults)
        .values({ eventId, categoryId, nomineeId: nominee.id, rawVoteCount, adjustedVoteCount: rawVoteCount, finalRank: index + 1, isWinner: index === 0 && nominee.status !== "DISQUALIFIED", isDisqualified: nominee.status === "DISQUALIFIED" })
        .onConflictDoUpdate({
          target: [officialResults.eventId, officialResults.categoryId, officialResults.nomineeId],
          set: { rawVoteCount, adjustedVoteCount: rawVoteCount, finalRank: index + 1, isWinner: index === 0 && nominee.status !== "DISQUALIFIED", isDisqualified: nominee.status === "DISQUALIFIED", updatedAt: new Date() },
        });
    }
  }
}

// Retrieve tabulated event results (excl. invalidated sessions)
export async function getEventResultsAction(eventId: string) {
  await requireEventAccess(eventId, ALL_MEMBERS, "view_results");
  return await tabulateEventResults(eventId);
}

// Publish/unpublish results settings
export async function publishResultsAction(eventId: string, publish: boolean) {
  const { user, workspace } = await requireEventAccess(eventId, RESULTS_MANAGERS, "publish_results");
  await db.transaction(async (tx) => {
    if (publish) {
      await snapshotOfficialResults(tx, eventId);
      await tx.insert(archiveConfigs).values({ eventId, updatedBy: user.id, isPublic: false }).onConflictDoUpdate({ target: archiveConfigs.eventId, set: { updatedBy: user.id, updatedAt: new Date() } });
    }
    await tx.update(events).set({ liveResultsMode: publish ? "FULL_LEADERBOARD" : "HIDDEN", updatedAt: new Date() }).where(eq(events.id, eventId));
    await tx.insert(resultActions).values({ eventId, actionType: publish ? "PUBLISH" : "UNPUBLISH", description: publish ? "Published official results" : "Unpublished official results", performedBy: user.id, reversible: true });
    await tx.insert(auditLogs).values({ workspaceId: workspace.id, eventId, actorId: user.id, action: publish ? "results.published" : "results.unpublished", targetType: "event", targetId: eventId });
  });

  return { success: true };
}

// Disqualify / restore nominee
export async function disqualifyNomineeAction(nomineeId: string, status: "ACTIVE" | "DISQUALIFIED") {
  // The caller supplies a nominee id, not an event id. Resolve the owning event
  // first so the workspace check has something to check against — otherwise any
  // authenticated member could disqualify a nominee in someone else's election.
  const [owner] = await db
    .select({ eventId: nominees.eventId })
    .from(nominees)
    .where(eq(nominees.id, nomineeId))
    .limit(1);

  if (!owner) {
    throw new Error("Nominee not found");
  }

  const { workspace, user } = await requireEventAccess(owner.eventId, RESULTS_MANAGERS, "publish_results");
  await db.transaction(async (tx) => {
    await tx.update(nominees).set({ status, updatedAt: new Date() }).where(eq(nominees.id, nomineeId));
    await tx.update(officialResults).set({ isDisqualified: status === "DISQUALIFIED", isWinner: false, updatedAt: new Date() }).where(and(eq(officialResults.eventId, owner.eventId), eq(officialResults.nomineeId, nomineeId)));
    const [official] = await tx.select({ id: officialResults.id }).from(officialResults).where(and(eq(officialResults.eventId, owner.eventId), eq(officialResults.nomineeId, nomineeId))).limit(1);
    await tx.insert(resultActions).values({ eventId: owner.eventId, officialResultId: official?.id ?? null, actionType: status === "DISQUALIFIED" ? "DISQUALIFY" : "RESTORE", description: status === "DISQUALIFIED" ? "Disqualified nominee" : "Restored nominee", performedBy: user.id, reversible: true });
    await tx.insert(auditLogs).values({ workspaceId: workspace.id, eventId: owner.eventId, actorId: user.id, action: status === "DISQUALIFIED" ? "nominee.disqualified" : "nominee.restored", targetType: "nominee", targetId: nomineeId });
  });

  return { success: true };
}

// Public-facing getter by slug
export async function getPublicEventResultsAction(slug: string) {
  const eventList = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, slug), isNull(events.deletedAt)))
    .limit(1);

  if (eventList.length === 0) {
    return null;
  }

  const event = eventList[0];
  if (event.visibility === "PRIVATE") return null;

  // If results are hidden, restrict payload details unless standard layout allows
  if (event.liveResultsMode === "HIDDEN") {
    return {
      name: event.name,
      slug: event.slug,
      liveResultsMode: event.liveResultsMode,
      categoriesResults: [],
    };
  }

  // Deliberately the unguarded cores: this path is authorized by the public
  // slug plus the `liveResultsMode` check above, not by workspace membership.
  const results = await tabulateEventResults(event.id);
  const awards = await listSpecialAwards(event.id);
  const disclosedResults = results.categoriesResults.map((category) => ({
    id: category.id,
    categoryName: category.categoryName,
    totalVotes: event.liveResultsMode === "VOTE_COUNTS" || event.liveResultsMode === "FULL_LEADERBOARD"
      ? category.totalVotes
      : undefined,
    winners: category.winners.map((candidate) => discloseCandidate(candidate, event.liveResultsMode)),
  }));

  return {
    ...results,
    slug: event.slug,
    categoriesResults: disclosedResults,
    specialAwards: awards,
  };
}

// Export raw ballots log
export async function getRawBallotsExportAction(eventId: string) {
  // Rows carry voter emails, invitation codes, IPs and user agents — same tier
  // as the audit-log export in exports.ts.
  await requireEventAccess(eventId, EVENT_ADMINS, "manage_events");

  return await db
    .select({
      sessionId: voteSessions.id,
      verifiedEmail: voteSessions.verifiedEmail,
      invitationCode: voteSessions.invitationCode,
      ipAddress: voteSessions.ipAddress,
      userAgent: voteSessions.userAgent,
      status: voteSessions.status,
      categoryName: categories.name,
      nomineeName: nominees.name,
      skipped: votes.skipped,
      submittedAt: voteSessions.submittedAt,
    })
    .from(votes)
    .innerJoin(voteSessions, eq(votes.voteSessionId, voteSessions.id))
    .innerJoin(categories, eq(votes.categoryId, categories.id))
    .leftJoin(nominees, eq(votes.nomineeId, nominees.id))
    // Only include ballots from sessions that are fully submitted (exclude FLAGGED/INVALIDATED)
    .where(and(eq(votes.eventId, eventId), eq(voteSessions.status, "SUBMITTED")))
    .orderBy(desc(voteSessions.submittedAt));
}

// Export voter logs
export async function getVoterLogsExportAction(eventId: string) {
  // Emails paired with live OTP codes and unredeemed invitation codes: leaking
  // this hands over the ability to vote as someone else.
  await requireEventAccess(eventId, EVENT_ADMINS, "manage_events");

  const otps = await db
    .select()
    .from(voterOtps)
    .where(eq(voterOtps.eventId, eventId))
    .orderBy(desc(voterOtps.expiresAt));

  const codes = await db
    .select()
    .from(invitationCodes)
    .where(eq(invitationCodes.eventId, eventId))
    .orderBy(desc(invitationCodes.createdAt));

  return {
    // Codes are stored hashed and are deliberately not exported. This export
    // previously carried live plaintext OTPs, so anyone who could download it
    // could cast those voters' ballots. Status is what an auditor needs here.
    otps: otps.map(o => ({
      email: o.email,
      issuedAt: o.createdAt ? new Date(o.createdAt).toLocaleString() : "",
      expiresAt: o.expiresAt ? new Date(o.expiresAt).toLocaleString() : "",
      verified: o.verified ? "YES" : "NO"
    })),
    codes: codes.map(c => ({
      codeId: c.id,
      status: c.status,
      usedAt: c.usedAt ? new Date(c.usedAt).toLocaleString() : "",
      expiresAt: c.expiresAt ? new Date(c.expiresAt).toLocaleString() : ""
    }))
  };
}

export async function createSpecialAwardAction(
  eventId: string,
  name: string,
  recipientName: string,
  description?: string
) {
  const { user } = await requireEventAccess(eventId, RESULTS_MANAGERS, "publish_results");

  const [award] = await db
    .insert(specialAwards)
    .values({
      eventId,
      name: name.trim(),
      recipientName: recipientName.trim(),
      description: description?.trim() || "",
      displayOrder: 1,
      // Attribute to whoever actually created it. This used to copy the event's
      // creator (falling back to the all-zero dev id), which made the audit
      // trail lie about who added the award.
      createdBy: user.id,
    })
    .returning();

  return { success: true, award };
}

/**
 * Listing core — no access control. Guarded by `getSpecialAwardsAction` for
 * dashboard callers; reached directly only from the public results path.
 */
async function listSpecialAwards(eventId: string) {
  return await db
    .select()
    .from(specialAwards)
    .where(eq(specialAwards.eventId, eventId))
    .orderBy(desc(specialAwards.createdAt));
}

export async function getSpecialAwardsAction(eventId: string) {
  await requireEventAccess(eventId, ALL_MEMBERS, "view_results");
  return await listSpecialAwards(eventId);
}

export async function deleteSpecialAwardAction(awardId: string) {
  // Award id in, event id out — see disqualifyNomineeAction for why.
  const [owner] = await db
    .select({ eventId: specialAwards.eventId })
    .from(specialAwards)
    .where(eq(specialAwards.id, awardId))
    .limit(1);

  if (!owner) {
    throw new Error("Special award not found");
  }

  await requireEventAccess(owner.eventId, RESULTS_MANAGERS, "publish_results");

  await db.delete(specialAwards).where(eq(specialAwards.id, awardId));
  return { success: true };
}

export async function updateOfficialResultOverrideAction(input: {
  eventId: string;
  officialResultId: string;
  rank: number | null;
  reason: string;
}) {
  const { user, workspace } = await requireEventAccess(input.eventId, RESULTS_MANAGERS, "publish_results");
  const reason = input.reason.trim();
  if (input.rank !== null && (!Number.isInteger(input.rank) || input.rank < 1 || input.rank > 999)) {
    throw new Error("Override rank must be a whole number between 1 and 999.");
  }
  if (input.rank !== null && reason.length < 5) {
    throw new Error("Explain the reason for an official rank override.");
  }
  const [result] = await db.select().from(officialResults).where(and(eq(officialResults.id, input.officialResultId), eq(officialResults.eventId, input.eventId))).limit(1);
  if (!result) throw new Error("Official result not found. Publish a snapshot first.");

  await db.transaction(async (tx) => {
    await tx.update(officialResults).set({ overrideRank: input.rank, overrideReason: input.rank === null ? null : reason, finalRank: input.rank ?? result.finalRank, updatedAt: new Date() }).where(eq(officialResults.id, result.id));
    await tx.insert(resultActions).values({ eventId: input.eventId, officialResultId: result.id, actionType: input.rank === null ? "RESTORE" : "OVERRIDE_RANK", description: input.rank === null ? "Removed official rank override" : `Overrode official rank to ${input.rank}`, explanation: input.rank === null ? null : reason, performedBy: user.id, reversible: true });
    await tx.insert(auditLogs).values({ workspaceId: workspace.id, eventId: input.eventId, actorId: user.id, action: input.rank === null ? "official_result.override_removed" : "official_result.rank_overridden", targetType: "official_result", targetId: result.id, details: { rank: input.rank, reason: input.rank === null ? null : reason } });
  });
  return { success: true };
}

export async function getPublishedCertificateCandidatesAction() {
  const { workspace } = await requireWorkspaceRole(ALL_MEMBERS);
  return db
    .select({
      officialResultId: officialResults.id,
      eventId: events.id,
      eventName: events.name,
      categoryName: categories.name,
      winnerName: nominees.name,
      finalRank: officialResults.finalRank,
      accentColor: eventBranding.accentColor,
    })
    .from(officialResults)
    .innerJoin(events, eq(officialResults.eventId, events.id))
    .innerJoin(categories, eq(officialResults.categoryId, categories.id))
    .innerJoin(nominees, eq(officialResults.nomineeId, nominees.id))
    .leftJoin(eventBranding, eq(eventBranding.eventId, events.id))
    .where(
      and(
        eq(events.workspaceId, workspace.id),
        isNull(events.deletedAt),
        sql`${events.liveResultsMode} <> 'HIDDEN'`,
        eq(officialResults.isWinner, true),
        eq(officialResults.isDisqualified, false),
      ),
    )
    .orderBy(desc(events.updatedAt), categories.displayOrder);
}
