"use server";

import { db } from "@/lib/db";
import { categories, nominees } from "@/lib/db/schema";
import { getOrCreateWorkspaceAction } from "./workspaces";
import { eq } from "drizzle-orm";
import { normalizeCapitalization } from "@/lib/ai/cleanup";

export interface BulkImportItem {
  categoryName: string;
  categoryDescription?: string;
  nomineeName: string;
  nomineeBio?: string;
  nomineePhotoUrl?: string;
  nomineeEmail?: string;
}

export async function bulkImportCategoriesAndNomineesAction(
  eventId: string,
  items: BulkImportItem[]
) {
  const workspace = await getOrCreateWorkspaceAction();
  if (!workspace) {
    throw new Error("Unauthorized workspace access");
  }

  if (!items || items.length === 0) {
    throw new Error("No import items provided");
  }

  return await db.transaction(async (tx) => {
    // 1. Fetch existing categories for this event
    const existingCats = await tx
      .select()
      .from(categories)
      .where(eq(categories.eventId, eventId));

    const categoryMap = new Map<string, string>(); // categoryName.toLowerCase() -> categoryId
    let maxCatOrder = 0;

    existingCats.forEach((c) => {
      categoryMap.set(c.name.toLowerCase().trim(), c.id);
      if (c.displayOrder > maxCatOrder) maxCatOrder = c.displayOrder;
    });

    let categoriesCreatedCount = 0;
    let nomineesImportedCount = 0;

    // 2. Process unique categories from import payload
    for (const item of items) {
      const catNameClean = item.categoryName.trim();
      const catKey = catNameClean.toLowerCase();

      if (!categoryMap.has(catKey)) {
        maxCatOrder += 1;
        const [newCat] = await tx
          .insert(categories)
          .values({
            eventId,
            name: catNameClean,
            description: item.categoryDescription?.trim() || "",
            displayOrder: maxCatOrder,
            isActive: true,
          })
          .returning();

        categoryMap.set(catKey, newCat.id);
        categoriesCreatedCount += 1;
      }
    }

    // Track nominee display order per category
    const categoryNomineeOrderMap = new Map<string, number>();

    // 3. Batch insert nominees under matching category IDs
    for (const item of items) {
      const catKey = item.categoryName.trim().toLowerCase();
      const categoryId = categoryMap.get(catKey);

      if (categoryId && item.nomineeName.trim()) {
        const currentOrder = (categoryNomineeOrderMap.get(categoryId) || 0) + 1;
        categoryNomineeOrderMap.set(categoryId, currentOrder);

        const cleanName = item.nomineeName.trim();
        const normalized = cleanName.toLowerCase().replace(/\s+/g, " ");

        await tx.insert(nominees).values({
          eventId,
          categoryId,
          name: normalizeCapitalization(cleanName),
          normalizedName: normalized,
          bio: item.nomineeBio?.trim() || "",
          photoUrl: item.nomineePhotoUrl?.trim() || null,
          displayOrder: currentOrder,
          status: "ACTIVE",
          source: "MANUAL",
        });
        nomineesImportedCount += 1;
      }
    }

    return {
      success: true,
      categoriesCreated: categoriesCreatedCount,
      nomineesImported: nomineesImportedCount,
      totalProcessed: items.length,
    };
  });
}
