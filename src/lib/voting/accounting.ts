import { and, countDistinct, eq, sql } from "drizzle-orm";
import { categories, votes, voteSessions } from "@/lib/db/schema";

type AccountingDatabase = Pick<typeof import("@/lib/db").db, "select">;

export type CategoryVoteAccounting = {
  categoryId: string;
  categoryName: string;
  submittedBallots: number;
  categoryResponses: number;
  selectedVotes: number;
  skippedResponses: number;
  turnoutPercent: number;
};

export type EventVoteAccounting = {
  submittedBallots: number;
  selectedVotes: number;
  skippedResponses: number;
  categoryResponses: number;
  categories: CategoryVoteAccounting[];
};

export async function getEventVoteAccounting(
  eventId: string,
  providedDatabase?: AccountingDatabase,
): Promise<EventVoteAccounting> {
  const database = providedDatabase ?? (await import("@/lib/db")).db;
  const [summaryRows, categoryRows] = await Promise.all([
    database
      .select({
        submittedBallots: countDistinct(voteSessions.id),
        selectedVotes: sql<number>`count(${votes.id}) filter (where ${votes.skipped} is not true and ${votes.nomineeId} is not null)::int`,
        skippedResponses: sql<number>`count(${votes.id}) filter (where ${votes.skipped} is true)::int`,
        categoryResponses: sql<number>`count(${votes.id})::int`,
      })
      .from(voteSessions)
      .leftJoin(votes, eq(votes.voteSessionId, voteSessions.id))
      .where(and(eq(voteSessions.eventId, eventId), eq(voteSessions.status, "SUBMITTED"))),
    database
      .select({
        categoryId: categories.id,
        categoryName: categories.name,
        categoryResponses: sql<number>`count(${votes.id}) filter (where ${voteSessions.status} = 'SUBMITTED')::int`,
        selectedVotes: sql<number>`count(${votes.id}) filter (where ${voteSessions.status} = 'SUBMITTED' and ${votes.skipped} is not true and ${votes.nomineeId} is not null)::int`,
        skippedResponses: sql<number>`count(${votes.id}) filter (where ${voteSessions.status} = 'SUBMITTED' and ${votes.skipped} is true)::int`,
      })
      .from(categories)
      .leftJoin(votes, eq(votes.categoryId, categories.id))
      .leftJoin(voteSessions, eq(voteSessions.id, votes.voteSessionId))
      .where(eq(categories.eventId, eventId))
      .groupBy(categories.id, categories.name, categories.displayOrder)
      .orderBy(categories.displayOrder),
  ]);

  const summary = summaryRows[0];
  const submittedBallots = Number(summary?.submittedBallots ?? 0);

  return {
    submittedBallots,
    selectedVotes: Number(summary?.selectedVotes ?? 0),
    skippedResponses: Number(summary?.skippedResponses ?? 0),
    categoryResponses: Number(summary?.categoryResponses ?? 0),
    categories: categoryRows.map((category) => {
      const categoryResponses = Number(category.categoryResponses ?? 0);
      return {
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        submittedBallots,
        categoryResponses,
        selectedVotes: Number(category.selectedVotes ?? 0),
        skippedResponses: Number(category.skippedResponses ?? 0),
        turnoutPercent: submittedBallots > 0
          ? Math.round((categoryResponses / submittedBallots) * 100)
          : 0,
      };
    }),
  };
}
