"use server";

import { db } from "@/lib/db";
import {
  aiCleanupTasks,
  aiMergeSuggestions,
  nominations as nominationsTable,
  categories,
  nominees,
} from "@/lib/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { getCurrentUser, ensureUserRecord, getOrCreateWorkspaceAction } from "./workspaces";
import { runAINominationCleanup } from "@/lib/ai/cleanup";

export async function triggerAICleanupAction(eventId: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  await ensureUserRecord(user.id, user.email, user.displayName);

  // 1. Create a task record
  const newTasks = await db
    .insert(aiCleanupTasks)
    .values({
      eventId,
      triggeredBy: user.id,
      status: "PROCESSING",
      startedAt: new Date(),
    })
    .returning({ id: aiCleanupTasks.id });

  const taskId = newTasks[0].id;

  try {
    // 2. Fetch all raw nominations for the event
    const noms = await db
      .select({
        id: nominationsTable.id,
        nomineeText: nominationsTable.nomineeText,
        categoryId: nominationsTable.categoryId,
        categoryName: categories.name,
      })
      .from(nominationsTable)
      .innerJoin(categories, eq(nominationsTable.categoryId, categories.id))
      .where(eq(nominationsTable.eventId, eventId));

    if (noms.length === 0) {
      // Complete with empty stats
      await db
        .update(aiCleanupTasks)
        .set({
          status: "COMPLETED",
          completedAt: new Date(),
          stats: {
            blankRemovedCount: 0,
            normalizedCount: 0,
            suggestionCount: 0,
          },
        })
        .where(eq(aiCleanupTasks.id, taskId));

      return { success: true, taskId, suggestionCount: 0 };
    }

    // 3. Run the AI pipeline
    const pipelineResult = await runAINominationCleanup(noms);

    // 4. Save recommendations to database
    if (pipelineResult.mergeSuggestions.length > 0) {
      const insertValues = pipelineResult.mergeSuggestions.map((sug) => ({
        cleanupTaskId: taskId,
        eventId,
        categoryId: sug.categoryId,
        sourceNominees: sug.sourceNominees,
        suggestedName: sug.suggestedName,
        confidence: sug.confidence,
        confidenceTier: sug.confidenceTier,
        matchReason: sug.matchReason,
        status: "PENDING" as const,
      }));

      await db.insert(aiMergeSuggestions).values(insertValues);
    }

    // 5. Update task stats
    await db
      .update(aiCleanupTasks)
      .set({
        status: "COMPLETED",
        completedAt: new Date(),
        stats: {
          blankRemovedCount: pipelineResult.blankRemovedCount,
          normalizedCount: pipelineResult.normalizedCount,
          suggestionCount: pipelineResult.mergeSuggestions.length,
        },
      })
      .where(eq(aiCleanupTasks.id, taskId));

    return {
      success: true,
      taskId,
      suggestionCount: pipelineResult.mergeSuggestions.length,
    };
  } catch (error: any) {
    console.error("AI Cleanup error:", error);
    await db
      .update(aiCleanupTasks)
      .set({
        status: "FAILED",
        completedAt: new Date(),
      })
      .where(eq(aiCleanupTasks.id, taskId));

    throw new Error(error?.message || "AI Cleanup pipeline failed.");
  }
}

export async function getLatestCleanupTaskAction(eventId: string) {
  const workspace = await getOrCreateWorkspaceAction();
  if (!workspace) {
    throw new Error("Unauthorized");
  }

  // Get latest completed task
  const taskList = await db
    .select()
    .from(aiCleanupTasks)
    .where(and(eq(aiCleanupTasks.eventId, eventId), eq(aiCleanupTasks.status, "COMPLETED")))
    .orderBy(desc(aiCleanupTasks.createdAt))
    .limit(1);

  if (taskList.length === 0) {
    return null;
  }

  const task = taskList[0];

  // Get all suggestions for this task
  const suggestions = await db
    .select({
      id: aiMergeSuggestions.id,
      categoryId: aiMergeSuggestions.categoryId,
      categoryName: categories.name,
      sourceNominees: aiMergeSuggestions.sourceNominees,
      suggestedName: aiMergeSuggestions.suggestedName,
      confidence: aiMergeSuggestions.confidence,
      confidenceTier: aiMergeSuggestions.confidenceTier,
      matchReason: aiMergeSuggestions.matchReason,
      status: aiMergeSuggestions.status,
    })
    .from(aiMergeSuggestions)
    .innerJoin(categories, eq(aiMergeSuggestions.categoryId, categories.id))
    .where(eq(aiMergeSuggestions.cleanupTaskId, task.id))
    .orderBy(desc(aiMergeSuggestions.confidence));

  return {
    task,
    suggestions,
  };
}

export async function approveMergeSuggestionAction(suggestionId: string, customName?: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  return await db.transaction(async (tx) => {
    const sugList = await tx
      .select()
      .from(aiMergeSuggestions)
      .where(eq(aiMergeSuggestions.id, suggestionId))
      .limit(1);

    if (sugList.length === 0) throw new Error("Suggestion not found");
    const sug = sugList[0];

    const finalName = customName?.trim() || sug.suggestedName;
    const normalizedName = finalName.toLowerCase().trim();
    let nomineeId = "";

    // 1. Find or create Nominee
    const existingList = await tx
      .select()
      .from(nominees)
      .where(and(eq(nominees.categoryId, sug.categoryId), eq(nominees.normalizedName, normalizedName)))
      .limit(1);

    const sourceNames = sug.sourceNominees as string[];

    if (existingList.length > 0) {
      nomineeId = existingList[0].id;
      // Increment nominee count
      await tx
        .update(nominees)
        .set({
          nominationCount: (existingList[0].nominationCount || 0) + sourceNames.length,
          updatedAt: new Date(),
        })
        .where(eq(nominees.id, nomineeId));
    } else {
      // Get max display order
      const maxOrderResult = await tx
        .select({ maxOrder: sql<number>`max(${nominees.displayOrder})` })
        .from(nominees)
        .where(eq(nominees.categoryId, sug.categoryId));
      const nextOrder = (maxOrderResult[0]?.maxOrder || 0) + 1;

      const newNom = await tx
        .insert(nominees)
        .values({
          eventId: sug.eventId,
          categoryId: sug.categoryId,
          name: finalName,
          normalizedName,
          displayOrder: nextOrder,
          status: "ACTIVE",
          source: "AI_SUGGESTED",
          nominationCount: sourceNames.length,
        })
        .returning({ id: nominees.id });

      nomineeId = newNom[0].id;
    }

    // 2. Point all matching raw nominations to this resolved nominee ID
    for (const sourceName of sourceNames) {
      await tx
        .update(nominationsTable)
        .set({ resolvedNomineeId: nomineeId })
        .where(
          and(
            eq(nominationsTable.eventId, sug.eventId),
            eq(nominationsTable.categoryId, sug.categoryId),
            eq(nominationsTable.nomineeText, sourceName)
          )
        );
    }

    // 3. Mark suggestion status APPROVED
    await tx
      .update(aiMergeSuggestions)
      .set({
        status: "APPROVED",
        reviewedBy: user.id,
        reviewedAt: new Date(),
      })
      .where(eq(aiMergeSuggestions.id, suggestionId));

    return { success: true };
  });
}

export async function rejectMergeSuggestionAction(suggestionId: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  await db
    .update(aiMergeSuggestions)
    .set({
      status: "REJECTED",
      reviewedBy: user.id,
      reviewedAt: new Date(),
    })
    .where(eq(aiMergeSuggestions.id, suggestionId));

  return { success: true };
}

export async function undoMergeSuggestionAction(suggestionId: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  return await db.transaction(async (tx) => {
    const sugList = await tx
      .select()
      .from(aiMergeSuggestions)
      .where(eq(aiMergeSuggestions.id, suggestionId))
      .limit(1);

    if (sugList.length === 0) throw new Error("Suggestion not found");
    const sug = sugList[0];

    if (sug.status !== "APPROVED") {
      throw new Error("Only approved suggestions can be undone");
    }

    // 1. Revert resolvedNomineeId to null for all matching raw nominations
    const sourceNames = sug.sourceNominees as string[];
    for (const sourceName of sourceNames) {
      await tx
        .update(nominationsTable)
        .set({ resolvedNomineeId: null })
        .where(
          and(
            eq(nominationsTable.eventId, sug.eventId),
            eq(nominationsTable.categoryId, sug.categoryId),
            eq(nominationsTable.nomineeText, sourceName)
          )
        );
    }

    // 2. Mark suggestion status back to PENDING
    await tx
      .update(aiMergeSuggestions)
      .set({
        status: "PENDING",
        reviewedBy: null,
        reviewedAt: null,
      })
      .where(eq(aiMergeSuggestions.id, suggestionId));

    return { success: true };
  });
}

export async function bulkApproveMergeSuggestionsAction(suggestionIds: string[]) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  if (suggestionIds.length === 0) return { success: true };

  // Loop and approve each suggestion in a single transaction
  return await db.transaction(async (tx) => {
    for (const id of suggestionIds) {
      const sugList = await tx
        .select()
        .from(aiMergeSuggestions)
        .where(and(eq(aiMergeSuggestions.id, id), eq(aiMergeSuggestions.status, "PENDING")))
        .limit(1);

      if (sugList.length === 0) continue;
      const sug = sugList[0];

      const sourceNames = sug.sourceNominees as string[];
      const normalizedName = sug.suggestedName.toLowerCase().trim();
      let nomineeId = "";

      // 1. Find or create nominee
      const existingList = await tx
        .select()
        .from(nominees)
        .where(and(eq(nominees.categoryId, sug.categoryId), eq(nominees.normalizedName, normalizedName)))
        .limit(1);

      if (existingList.length > 0) {
        nomineeId = existingList[0].id;
        await tx
          .update(nominees)
          .set({
            nominationCount: (existingList[0].nominationCount || 0) + sourceNames.length,
            updatedAt: new Date(),
          })
          .where(eq(nominees.id, nomineeId));
      } else {
        const maxOrderResult = await tx
          .select({ maxOrder: sql<number>`max(${nominees.displayOrder})` })
          .from(nominees)
          .where(eq(nominees.categoryId, sug.categoryId));
        const nextOrder = (maxOrderResult[0]?.maxOrder || 0) + 1;

        const newNom = await tx
          .insert(nominees)
          .values({
            eventId: sug.eventId,
            categoryId: sug.categoryId,
            name: sug.suggestedName,
            normalizedName,
            displayOrder: nextOrder,
            status: "ACTIVE",
            source: "AI_SUGGESTED",
            nominationCount: sourceNames.length,
          })
          .returning({ id: nominees.id });

        nomineeId = newNom[0].id;
      }

      // 2. Link nominations
      for (const sourceName of sourceNames) {
        await tx
          .update(nominationsTable)
          .set({ resolvedNomineeId: nomineeId })
          .where(
            and(
              eq(nominationsTable.eventId, sug.eventId),
              eq(nominationsTable.categoryId, sug.categoryId),
              eq(nominationsTable.nomineeText, sourceName)
            )
          );
      }

      // 3. Mark approved
      await tx
        .update(aiMergeSuggestions)
        .set({
          status: "APPROVED",
          reviewedBy: user.id,
          reviewedAt: new Date(),
        })
        .where(eq(aiMergeSuggestions.id, id));
    }

    return { success: true };
  });
}
