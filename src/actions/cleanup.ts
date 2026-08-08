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
import { requireWorkspaceRole, requireEventAccess, CONTENT_MODERATORS, EVENT_ADMINS } from "./_rbac";
import { runAINominationCleanup } from "@/lib/ai/cleanup";

/**
 * Resolve the event owning `suggestionId` and authorize against it. Merge
 * suggestions are addressed by their own id, so without this a moderator in one
 * workspace could approve merges that rewrite another workspace's nominees.
 */
async function requireSuggestionAccess(
  suggestionId: string,
  allowedRoles: Parameters<typeof requireEventAccess>[1]
) {
  const [suggestion] = await db
    .select({ eventId: aiMergeSuggestions.eventId })
    .from(aiMergeSuggestions)
    .where(eq(aiMergeSuggestions.id, suggestionId))
    .limit(1);

  if (!suggestion) {
    throw new Error("Merge suggestion not found");
  }

  return await requireEventAccess(suggestion.eventId, allowedRoles);
}

export async function triggerAICleanupAction(eventId: string) {
  const { user } = await requireEventAccess(eventId, EVENT_ADMINS);

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
  const { workspace } = await requireEventAccess(eventId, CONTENT_MODERATORS);

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
  const { user } = await requireSuggestionAccess(suggestionId, CONTENT_MODERATORS);

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
  const { user } = await requireSuggestionAccess(suggestionId, CONTENT_MODERATORS);

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
  const { user } = await requireSuggestionAccess(suggestionId, CONTENT_MODERATORS);

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
  if (suggestionIds.length === 0) return { success: true };

  // Authorize every event represented in the batch before approving any of it.
  // Ids that resolve to another workspace throw here rather than being silently
  // skipped, so a mixed batch fails loudly instead of partially applying.
  const owners = await db
    .selectDistinct({ eventId: aiMergeSuggestions.eventId })
    .from(aiMergeSuggestions)
    .where(inArray(aiMergeSuggestions.id, suggestionIds));

  let user;
  for (const owner of owners) {
    ({ user } = await requireEventAccess(owner.eventId, CONTENT_MODERATORS));
  }

  if (!user) {
    // Nothing in the batch resolved to a real suggestion; still prove the caller
    // is a seated moderator rather than returning success to anyone.
    ({ user } = await requireWorkspaceRole(CONTENT_MODERATORS));
    return { success: true };
  }

  // Loop and approve each suggestion in a single transaction
  return await db.transaction(async (tx) => {
    const pending = await tx
      .select()
      .from(aiMergeSuggestions)
      .where(
        and(inArray(aiMergeSuggestions.id, suggestionIds), eq(aiMergeSuggestions.status, "PENDING"))
      );

    if (pending.length === 0) {
      return { success: true };
    }

    // Two suggestions in one batch can normalise to the same nominee. The old
    // per-suggestion loop absorbed that by re-querying every iteration; batching
    // means collapsing them here so their nomination counts add up instead of
    // the second overwriting the first.
    type Group = {
      eventId: string;
      categoryId: string;
      name: string;
      normalizedName: string;
      sourceNames: string[];
      count: number;
    };
    const groups = new Map<string, Group>();
    const groupKey = (categoryId: string, normalizedName: string) =>
      `${categoryId}::${normalizedName}`;

    for (const sug of pending) {
      const normalizedName = sug.suggestedName.toLowerCase().trim();
      const key = groupKey(sug.categoryId, normalizedName);
      const sourceNames = (sug.sourceNominees as string[]) || [];
      const existing = groups.get(key);

      if (existing) {
        existing.sourceNames.push(...sourceNames);
        existing.count += sourceNames.length;
      } else {
        groups.set(key, {
          eventId: sug.eventId,
          categoryId: sug.categoryId,
          name: sug.suggestedName,
          normalizedName,
          sourceNames: [...sourceNames],
          count: sourceNames.length,
        });
      }
    }

    // One read covers both lookups the old loop did per suggestion: which
    // nominees already exist, and the next free display order per category.
    const categoryIds = [...new Set(pending.map((s) => s.categoryId))];
    const categoryNominees = await tx
      .select({
        id: nominees.id,
        categoryId: nominees.categoryId,
        normalizedName: nominees.normalizedName,
        displayOrder: nominees.displayOrder,
        nominationCount: nominees.nominationCount,
      })
      .from(nominees)
      .where(inArray(nominees.categoryId, categoryIds));

    const existingByKey = new Map<string, (typeof categoryNominees)[number]>();
    const nextOrderByCategory = new Map<string, number>();
    for (const nom of categoryNominees) {
      existingByKey.set(groupKey(nom.categoryId, nom.normalizedName), nom);
      nextOrderByCategory.set(
        nom.categoryId,
        Math.max(nextOrderByCategory.get(nom.categoryId) ?? 0, nom.displayOrder)
      );
    }

    // Resolve every group to a nominee id: insert the new ones in one statement,
    // bump the counts of the ones that already existed in another.
    const resolvedIdByKey = new Map<string, string>();
    const toInsert: (typeof nominees.$inferInsert)[] = [];
    const insertKeys: string[] = [];
    const countBumps: { id: string; nominationCount: number }[] = [];

    for (const [key, group] of groups) {
      const existing = existingByKey.get(key);
      if (existing) {
        resolvedIdByKey.set(key, existing.id);
        countBumps.push({
          id: existing.id,
          nominationCount: (existing.nominationCount || 0) + group.count,
        });
      } else {
        const nextOrder = (nextOrderByCategory.get(group.categoryId) ?? 0) + 1;
        nextOrderByCategory.set(group.categoryId, nextOrder);
        insertKeys.push(key);
        toInsert.push({
          eventId: group.eventId,
          categoryId: group.categoryId,
          name: group.name,
          normalizedName: group.normalizedName,
          displayOrder: nextOrder,
          status: "ACTIVE",
          source: "AI_SUGGESTED",
          nominationCount: group.count,
        });
      }
    }

    if (toInsert.length > 0) {
      const inserted = await tx.insert(nominees).values(toInsert).returning({ id: nominees.id });
      // `returning` preserves the order of `values`, so the two arrays line up.
      inserted.forEach((row, i) => resolvedIdByKey.set(insertKeys[i], row.id));
    }

    if (countBumps.length > 0) {
      // A single UPDATE with a CASE, rather than one round trip per nominee.
      const cases = countBumps.map(
        (b) => sql`when ${nominees.id} = ${b.id}::uuid then ${b.nominationCount}::int`
      );
      await tx
        .update(nominees)
        .set({
          nominationCount: sql`case ${sql.join(cases, sql` `)} else ${nominees.nominationCount} end`,
          updatedAt: new Date(),
        })
        .where(
          inArray(
            nominees.id,
            countBumps.map((b) => b.id)
          )
        );
    }

    // Point the raw nominations at their resolved nominee. The inner loop over
    // source names collapses into one `inArray` per nominee.
    for (const [key, group] of groups) {
      const nomineeId = resolvedIdByKey.get(key);
      if (!nomineeId || group.sourceNames.length === 0) continue;

      await tx
        .update(nominationsTable)
        .set({ resolvedNomineeId: nomineeId })
        .where(
          and(
            eq(nominationsTable.eventId, group.eventId),
            eq(nominationsTable.categoryId, group.categoryId),
            inArray(nominationsTable.nomineeText, [...new Set(group.sourceNames)])
          )
        );
    }

    await tx
      .update(aiMergeSuggestions)
      .set({
        status: "APPROVED",
        reviewedBy: user.id,
        reviewedAt: new Date(),
      })
      .where(
        inArray(
          aiMergeSuggestions.id,
          pending.map((s) => s.id)
        )
      );

    return { success: true };
  });
}
