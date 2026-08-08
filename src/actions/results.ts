"use server";

import { db } from "@/lib/db";
import { events, categories, nominees, votes, voteSessions, voterOtps, invitationCodes, specialAwards, officialResults } from "@/lib/db/schema";
import { eq, and, sql, isNull, not, desc } from "drizzle-orm";
import { requireEventAccess, RESULTS_MANAGERS, EVENT_ADMINS, ALL_MEMBERS } from "./_rbac";

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

      const judgeScore = officialRes[0]?.judgeScore ?? null;

      candidates.push({
        id: nom.id,
        name: nom.name,
        bio: nom.bio,
        votes: votesCount,
        judgeScore,
        status: nom.status, // ACTIVE | DISQUALIFIED | MERGED | REMOVED
      });
    }

    // Sort active candidates by vote totals descending
    const activeCandidates = candidates.filter((c) => c.status !== "MERGED" && c.status !== "REMOVED");
    activeCandidates.sort((a, b) => {
      // Push disqualified to bottom or just order by vote totals
      return b.votes - a.votes;
    });

    // Compute ranks and percentages
    const rankedWinners = activeCandidates.map((cand, idx) => {
      const percentageVal = totalCategoryVotes > 0 ? (cand.votes / totalCategoryVotes) * 100 : 0;
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
      totalVotes: totalCategoryVotes,
      winners: rankedWinners,
    });
  }

  return {
    eventId: event.id,
    name: event.name,
    liveResultsMode: event.liveResultsMode,
    categoriesResults: categoryResults,
  };
}

// Retrieve tabulated event results (excl. invalidated sessions)
export async function getEventResultsAction(eventId: string) {
  await requireEventAccess(eventId, ALL_MEMBERS);
  return await tabulateEventResults(eventId);
}

// Publish/unpublish results settings
export async function publishResultsAction(eventId: string, publish: boolean) {
  await requireEventAccess(eventId, RESULTS_MANAGERS);

  await db
    .update(events)
    .set({
      liveResultsMode: publish ? "FULL_LEADERBOARD" : "HIDDEN",
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId));

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

  await requireEventAccess(owner.eventId, RESULTS_MANAGERS);

  await db
    .update(nominees)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(nominees.id, nomineeId));

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

  return {
    ...results,
    slug: event.slug,
    specialAwards: awards,
  };
}

// Export raw ballots log
export async function getRawBallotsExportAction(eventId: string) {
  // Rows carry voter emails, invitation codes, IPs and user agents — same tier
  // as the audit-log export in exports.ts.
  await requireEventAccess(eventId, EVENT_ADMINS);

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
  await requireEventAccess(eventId, EVENT_ADMINS);

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
    otps: otps.map(o => ({
      email: o.email,
      code: o.code,
      expiresAt: o.expiresAt ? new Date(o.expiresAt).toLocaleString() : "",
      verified: o.verified ? "YES" : "NO"
    })),
    codes: codes.map(c => ({
      code: c.code,
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
  const { user } = await requireEventAccess(eventId, RESULTS_MANAGERS);

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
  await requireEventAccess(eventId, ALL_MEMBERS);
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

  await requireEventAccess(owner.eventId, RESULTS_MANAGERS);

  await db.delete(specialAwards).where(eq(specialAwards.id, awardId));
  return { success: true };
}

export async function updateNomineeJudgeScoreAction(
  eventId: string,
  categoryId: string,
  nomineeId: string,
  judgeScore: number
) {
  await requireEventAccess(eventId, RESULTS_MANAGERS);

  // The event is ours, but categoryId/nomineeId are still caller-supplied and
  // are written straight into official_results. Confirm the nominee sits in
  // this event *and* this category before scoring it.
  const [nominee] = await db
    .select({ id: nominees.id })
    .from(nominees)
    .where(
      and(
        eq(nominees.id, nomineeId),
        eq(nominees.eventId, eventId),
        eq(nominees.categoryId, categoryId)
      )
    )
    .limit(1);

  if (!nominee) {
    throw new Error("Nominee not found in this event category");
  }

  const cleanScore = Math.max(0, Math.min(100, judgeScore));

  const existing = await db
    .select()
    .from(officialResults)
    .where(
      and(
        eq(officialResults.eventId, eventId),
        eq(officialResults.categoryId, categoryId),
        eq(officialResults.nomineeId, nomineeId)
      )
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(officialResults).values({
      eventId,
      categoryId,
      nomineeId,
      rawVoteCount: 0,
      adjustedVoteCount: 0,
      finalRank: 1,
      judgeScore: cleanScore,
      compositeScore: cleanScore,
    });
  } else {
    await db
      .update(officialResults)
      .set({
        judgeScore: cleanScore,
        compositeScore: cleanScore,
        updatedAt: new Date(),
      })
      .where(eq(officialResults.id, existing[0].id));
  }

  return { success: true, score: cleanScore };
}
