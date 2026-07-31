"use server";

import { db } from "@/lib/db";
import { suggestedCategories, categories, nominations, events } from "@/lib/db/schema";
import { eq, and, count, desc, sql, isNull } from "drizzle-orm";
import { getOrCreateWorkspaceAction } from "./workspaces";

export async function getSuggestedCategoriesAction(eventId: string) {
  const workspace = await getOrCreateWorkspaceAction();
  if (!workspace) {
    throw new Error("Unauthorized");
  }

  // Group by suggestionText, count frequency, return status = PENDING suggestions
  const suggestions = await db
    .select({
      suggestionText: suggestedCategories.suggestionText,
      count: count(),
      latestId: sql<string>`max(${suggestedCategories.id}::text)`,
    })
    .from(suggestedCategories)
    .where(and(eq(suggestedCategories.eventId, eventId), eq(suggestedCategories.status, "PENDING")))
    .groupBy(suggestedCategories.suggestionText)
    .orderBy(desc(count()));

  return suggestions.map(s => ({
    id: s.latestId,
    suggestionText: s.suggestionText,
    count: s.count,
    status: "PENDING" as const,
  }));
}

export async function approveSuggestionAction(eventId: string, suggestionText: string, approvedName: string) {
  const workspace = await getOrCreateWorkspaceAction();
  if (!workspace) {
    throw new Error("Unauthorized");
  }

  return await db.transaction(async (tx) => {
    // Get max display order of categories in the event
    const maxOrderResult = await tx
      .select({ maxOrder: sql<number>`max(${categories.displayOrder})` })
      .from(categories)
      .where(eq(categories.eventId, eventId));
    const nextOrder = (maxOrderResult[0]?.maxOrder || 0) + 1;

    // Create category
    await tx.insert(categories).values({
      eventId,
      name: approvedName,
      displayOrder: nextOrder,
      isActive: true,
    });

    // Update suggestions status
    await tx
      .update(suggestedCategories)
      .set({
        status: "APPROVED",
        approvedName,
        reviewedAt: new Date(),
      })
      .where(and(eq(suggestedCategories.eventId, eventId), eq(suggestedCategories.suggestionText, suggestionText)));

    return { success: true };
  });
}

export async function rejectSuggestionAction(eventId: string, suggestionText: string) {
  const workspace = await getOrCreateWorkspaceAction();
  if (!workspace) {
    throw new Error("Unauthorized");
  }

  await db
    .update(suggestedCategories)
    .set({
      status: "REJECTED",
      reviewedAt: new Date(),
    })
    .where(and(eq(suggestedCategories.eventId, eventId), eq(suggestedCategories.suggestionText, suggestionText)));

  return { success: true };
}

export async function getWorkspaceNominationsAction() {
  const workspace = await getOrCreateWorkspaceAction();
  if (!workspace) {
    throw new Error("Unauthorized");
  }

  // Query nominations across workspace events
  const rawNomList = await db
    .select({
      id: nominations.id,
      eventTitle: events.name,
      categoryName: categories.name,
      nomineeText: nominations.nomineeText,
      sessionId: nominations.sessionId,
      createdAt: nominations.createdAt,
    })
    .from(nominations)
    .innerJoin(events, eq(nominations.eventId, events.id))
    .innerJoin(categories, eq(nominations.categoryId, categories.id))
    .where(and(eq(events.workspaceId, workspace.id), isNull(events.deletedAt)))
    .orderBy(desc(nominations.createdAt))
    .limit(50);

  // Query suggested categories across workspace events
  const sugList = await db
    .select({
      id: suggestedCategories.id,
      eventId: events.id,
      eventTitle: events.name,
      suggestionText: suggestedCategories.suggestionText,
      status: suggestedCategories.status,
      createdAt: suggestedCategories.createdAt,
    })
    .from(suggestedCategories)
    .innerJoin(events, eq(suggestedCategories.eventId, events.id))
    .where(and(eq(events.workspaceId, workspace.id), isNull(events.deletedAt), eq(suggestedCategories.status, "PENDING")))
    .orderBy(desc(suggestedCategories.createdAt))
    .limit(50);

  return {
    rawNominations: rawNomList.map((n) => ({
      ...n,
      date: new Date(n.createdAt).toLocaleString(),
    })),
    suggestedCategories: sugList.map((s) => ({
      ...s,
      date: new Date(s.createdAt).toLocaleDateString(),
    })),
  };
}
