"use server";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, categories, nominees, nominations, votes } from "@/lib/db/schema";
import { requireEventAccess, CONTENT_MODERATORS, EVENT_ADMINS } from "./_rbac";
import { createCategorySchema, createNomineeSchema } from "@/lib/validators";
import { sanitizePlainText } from "@/lib/sanitize";
import { normalizeCapitalization } from "@/lib/ai/cleanup";

export async function getEventCategoriesAction(eventId: string) {
  await requireEventAccess(eventId, CONTENT_MODERATORS, "manage_categories");

  return db
    .select()
    .from(categories)
    .where(eq(categories.eventId, eventId))
    .orderBy(asc(categories.displayOrder));
}

export async function createCategoryAction(
  eventId: string,
  input: unknown
) {
  const { user, workspace } = await requireEventAccess(eventId, EVENT_ADMINS, "manage_categories");
  const parsed = createCategorySchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("Category details are invalid.");
  }

  const [last] = await db
    .select({ displayOrder: categories.displayOrder })
    .from(categories)
    .where(eq(categories.eventId, eventId))
    .orderBy(sql`${categories.displayOrder} desc`)
    .limit(1);

  const category = await db.transaction(async (tx) => {
    const [created] = await tx.insert(categories).values({
        eventId,
        name: sanitizePlainText(parsed.data.name, 150),
        description: sanitizePlainText(parsed.data.description ?? "", 1000) || null,
        eligibility: sanitizePlainText(parsed.data.eligibility ?? "", 1000) || null,
        maxNomineesPerVoter: parsed.data.maxNomineesPerVoter,
        displayOrder: (last?.displayOrder ?? 0) + 1,
        isActive: true,
      }).returning();
    await tx.insert(auditLogs).values({ workspaceId: workspace.id, eventId, actorId: user.id, action: "category.created", targetType: "category", targetId: created.id, details: { name: created.name } });
    return created;
  });

  return category;
}

export async function updateCategoryAction(
  eventId: string,
  categoryId: string,
  input: unknown
) {
  const { user, workspace } = await requireEventAccess(eventId, EVENT_ADMINS, "manage_categories");
  const parsed = createCategorySchema.partial().safeParse(input);

  if (!parsed.success) {
    throw new Error("Category details are invalid.");
  }

  const [category] = await db
    .update(categories)
    .set({
      ...(parsed.data.name !== undefined && {
        name: sanitizePlainText(parsed.data.name, 150),
      }),
      ...(parsed.data.description !== undefined && {
        description: sanitizePlainText(parsed.data.description, 1000) || null,
      }),
      ...(parsed.data.eligibility !== undefined && {
        eligibility: sanitizePlainText(parsed.data.eligibility, 1000) || null,
      }),
      ...(parsed.data.maxNomineesPerVoter !== undefined && {
        maxNomineesPerVoter: parsed.data.maxNomineesPerVoter,
      }),
      updatedAt: new Date(),
    })
    .where(and(eq(categories.id, categoryId), eq(categories.eventId, eventId)))
    .returning();

  if (!category) throw new Error("Category not found.");
  await db.insert(auditLogs).values({ workspaceId: workspace.id, eventId, actorId: user.id, action: "category.updated", targetType: "category", targetId: category.id, details: parsed.data });
  return category;
}

export async function deactivateCategoryAction(eventId: string, categoryId: string) {
  const { user, workspace } = await requireEventAccess(eventId, EVENT_ADMINS, "manage_categories");

  const [category] = await db
    .update(categories)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(categories.id, categoryId), eq(categories.eventId, eventId)))
    .returning();

  if (!category) throw new Error("Category not found.");
  await db.insert(auditLogs).values({ workspaceId: workspace.id, eventId, actorId: user.id, action: "category.deactivated", targetType: "category", targetId: category.id });
  return category;
}

export async function deleteCategoryAction(eventId: string, categoryId: string) {
  const { user, workspace } = await requireEventAccess(eventId, EVENT_ADMINS, "manage_categories");

  const [ownedCategory] = await db.select({ id: categories.id }).from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.eventId, eventId))).limit(1);
  if (!ownedCategory) throw new Error("Category not found.");

  const [{ nominationCount }] = await db
    .select({ nominationCount: sql<number>`count(*)` })
    .from(nominations)
    .where(and(eq(nominations.eventId, eventId), eq(nominations.categoryId, categoryId)));
  const [{ nomineeCount }] = await db
    .select({ nomineeCount: sql<number>`count(*)` })
    .from(nominees)
    .where(and(eq(nominees.eventId, eventId), eq(nominees.categoryId, categoryId)));
  const [{ voteCount }] = await db
    .select({ voteCount: sql<number>`count(*)` })
    .from(votes)
    .where(and(eq(votes.eventId, eventId), eq(votes.categoryId, categoryId)));

  if (Number(voteCount) > 0) {
    throw new Error("This category has ballots and can only be deactivated.");
  }

  if (Number(nominationCount) > 0 || Number(nomineeCount) > 0) {
    throw new Error("This category has preparation data. Deactivate it instead of deleting it.");
  }

  const deleted = await db
    .delete(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.eventId, eventId)))
    .returning({ id: categories.id });

  if (deleted.length === 0) throw new Error("Category not found.");
  await db.insert(auditLogs).values({ workspaceId: workspace.id, eventId, actorId: user.id, action: "category.deleted", targetType: "category", targetId: categoryId });
  return { success: true };
}

export async function reorderCategoriesAction(eventId: string, orderedCategoryIds: string[]) {
  await requireEventAccess(eventId, EVENT_ADMINS, "manage_categories");

  if (orderedCategoryIds.length === 0) return { success: true };

  const owned = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.eventId, eventId), inArray(categories.id, orderedCategoryIds)));

  if (owned.length !== orderedCategoryIds.length) {
    throw new Error("Category order contains an invalid category.");
  }

  await db.transaction(async (tx) => {
    for (const [index, categoryId] of orderedCategoryIds.entries()) {
      await tx
        .update(categories)
        .set({ displayOrder: (index + 1) * 10, updatedAt: new Date() })
        .where(and(eq(categories.id, categoryId), eq(categories.eventId, eventId)));
    }
  });

  return { success: true };
}

export async function getEventNomineesByCategoryAction(eventId: string) {
  await requireEventAccess(eventId, CONTENT_MODERATORS, "manage_categories");

  return db
    .select({
      nominee: nominees,
      categoryName: categories.name,
      categoryOrder: categories.displayOrder,
    })
    .from(nominees)
    .innerJoin(categories, eq(nominees.categoryId, categories.id))
    .where(eq(nominees.eventId, eventId))
    .orderBy(asc(categories.displayOrder), asc(nominees.displayOrder));
}

export async function createNomineeAction(
  eventId: string,
  categoryId: string,
  input: unknown
) {
  await requireEventAccess(eventId, CONTENT_MODERATORS, "manage_categories");
  const parsed = createNomineeSchema.safeParse(input);
  if (!parsed.success) throw new Error("Nominee details are invalid.");

  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.eventId, eventId), eq(categories.isActive, true)))
    .limit(1);
  if (!category) throw new Error("Category not found in this event.");

  const [last] = await db
    .select({ displayOrder: nominees.displayOrder })
    .from(nominees)
    .where(eq(nominees.categoryId, categoryId))
    .orderBy(sql`${nominees.displayOrder} desc`)
    .limit(1);

  const name = sanitizePlainText(parsed.data.name, 200);
  const [nominee] = await db
    .insert(nominees)
    .values({
      eventId,
      categoryId,
      name,
      normalizedName: normalizeCapitalization(name).toLowerCase(),
      bio: sanitizePlainText(parsed.data.bio ?? "", 2000) || null,
      displayOrder: (last?.displayOrder ?? 0) + 1,
      source: "MANUAL",
      status: "ACTIVE",
      nominationCount: 0,
    })
    .returning();

  return nominee;
}

export async function updateNomineeAction(eventId: string, nomineeId: string, input: unknown) {
  await requireEventAccess(eventId, CONTENT_MODERATORS, "manage_categories");
  const parsed = createNomineeSchema.partial().safeParse(input);
  if (!parsed.success) throw new Error("Nominee details are invalid.");

  const name = parsed.data.name === undefined ? undefined : sanitizePlainText(parsed.data.name, 200);
  const [nominee] = await db
    .update(nominees)
    .set({
      ...(name !== undefined && { name, normalizedName: normalizeCapitalization(name).toLowerCase() }),
      ...(parsed.data.bio !== undefined && { bio: sanitizePlainText(parsed.data.bio, 2000) || null }),
      updatedAt: new Date(),
    })
    .where(and(eq(nominees.id, nomineeId), eq(nominees.eventId, eventId)))
    .returning();

  if (!nominee) throw new Error("Nominee not found.");
  return nominee;
}

export async function deactivateNomineeAction(eventId: string, nomineeId: string) {
  await requireEventAccess(eventId, CONTENT_MODERATORS, "manage_categories");

  const [nominee] = await db
    .update(nominees)
    .set({ status: "REMOVED", updatedAt: new Date() })
    .where(and(eq(nominees.id, nomineeId), eq(nominees.eventId, eventId)))
    .returning();

  if (!nominee) throw new Error("Nominee not found.");
  return nominee;
}

export async function deleteNomineeAction(eventId: string, nomineeId: string) {
  await requireEventAccess(eventId, CONTENT_MODERATORS, "manage_categories");

  const [ownedNominee] = await db.select({ id: nominees.id }).from(nominees)
    .where(and(eq(nominees.id, nomineeId), eq(nominees.eventId, eventId))).limit(1);
  if (!ownedNominee) throw new Error("Nominee not found.");

  const [{ voteCount }] = await db
    .select({ voteCount: sql<number>`count(*)` })
    .from(votes)
    .where(and(eq(votes.eventId, eventId), eq(votes.nomineeId, nomineeId)));

  if (Number(voteCount) > 0) {
    throw new Error("This nominee has ballots and can only be removed from future voting.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(nominations)
      .set({ resolvedNomineeId: null })
      .where(and(eq(nominations.eventId, eventId), eq(nominations.resolvedNomineeId, nomineeId)));

    const deleted = await tx
      .delete(nominees)
      .where(and(eq(nominees.id, nomineeId), eq(nominees.eventId, eventId)))
      .returning({ id: nominees.id });

    if (deleted.length === 0) throw new Error("Nominee not found.");
  });

  return { success: true };
}

export async function moveNomineeToCategoryAction(
  eventId: string,
  nomineeId: string,
  categoryId: string
) {
  await requireEventAccess(eventId, CONTENT_MODERATORS, "manage_categories");

  const [ownedNominee] = await db.select({ id: nominees.id }).from(nominees)
    .where(and(eq(nominees.id, nomineeId), eq(nominees.eventId, eventId))).limit(1);
  if (!ownedNominee) throw new Error("Nominee not found.");

  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.eventId, eventId), eq(categories.isActive, true)))
    .limit(1);
  if (!category) throw new Error("Category not found in this event.");

  const [{ voteCount }] = await db
    .select({ voteCount: sql<number>`count(*)` })
    .from(votes)
    .where(and(eq(votes.eventId, eventId), eq(votes.nomineeId, nomineeId)));
  if (Number(voteCount) > 0) throw new Error("A nominee with ballots cannot move categories.");

  const [last] = await db
    .select({ displayOrder: nominees.displayOrder })
    .from(nominees)
    .where(eq(nominees.categoryId, categoryId))
    .orderBy(sql`${nominees.displayOrder} desc`)
    .limit(1);

  const [nominee] = await db
    .update(nominees)
    .set({ categoryId, displayOrder: (last?.displayOrder ?? 0) + 1, updatedAt: new Date() })
    .where(and(eq(nominees.id, nomineeId), eq(nominees.eventId, eventId)))
    .returning();
  if (!nominee) throw new Error("Nominee not found.");
  return nominee;
}

export async function reorderNomineesAction(
  eventId: string,
  categoryId: string,
  orderedNomineeIds: string[]
) {
  await requireEventAccess(eventId, CONTENT_MODERATORS, "manage_categories");

  if (orderedNomineeIds.length === 0) return { success: true };

  const owned = await db
    .select({ id: nominees.id })
    .from(nominees)
    .where(
      and(
        eq(nominees.eventId, eventId),
        eq(nominees.categoryId, categoryId),
        inArray(nominees.id, orderedNomineeIds)
      )
    );
  if (owned.length !== orderedNomineeIds.length) {
    throw new Error("Nominee order contains an invalid nominee.");
  }

  await db.transaction(async (tx) => {
    for (const [index, nomineeId] of orderedNomineeIds.entries()) {
      await tx
        .update(nominees)
        .set({ displayOrder: (index + 1) * 10, updatedAt: new Date() })
        .where(and(eq(nominees.id, nomineeId), eq(nominees.eventId, eventId)));
    }
  });

  return { success: true };
}
