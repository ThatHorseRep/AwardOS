"use server";

import { db } from "@/lib/db";
import { categories, nominees, importRuns } from "@/lib/db/schema";
import { requireEventAccess, EVENT_ADMINS } from "./_rbac";
import { and, eq } from "drizzle-orm";
import { normalizeCapitalization } from "@/lib/ai/cleanup";
import { validateBulkImportItems, type BulkImportItem } from "@/lib/bulk-import";
import { extractMachineReadablePdfImport } from "@/lib/pdf-import";

export type { BulkImportItem } from "@/lib/bulk-import";
export type ImportExistingBehavior = "UPDATE" | "SKIP";
export interface BulkImportResult {
  success: boolean;
  categoriesCreated: number;
  nomineesImported: number;
  nomineesUpdated: number;
  nomineesSkipped: number;
  failedRows: Array<{ row: number; message: string }>;
  totalProcessed: number;
}

export async function parsePdfBulkImportAction(eventId: string, base64: string) {
  await requireEventAccess(eventId, EVENT_ADMINS, "manage_events");
  if (typeof base64 !== "string" || base64.length > 7_000_000) {
    throw new Error("PDF import payload is too large.");
  }
  return extractMachineReadablePdfImport(base64);
}

export async function previewBulkImportAction(eventId: string, items: BulkImportItem[]) {
  await requireEventAccess(eventId, EVENT_ADMINS, "manage_events");
  const validation = validateBulkImportItems(items);
  const cleanItems = validation.valid;
  const [existingCategories, existingNominees] = await Promise.all([db.select().from(categories).where(eq(categories.eventId, eventId)), db.select().from(nominees).where(eq(nominees.eventId, eventId))]);
  const categoryByName = new Map(existingCategories.map((category) => [category.name.toLowerCase().trim(), category.id]));
  const plannedCategoryNames = new Set<string>();
  const existingNomineeKeys = new Set(existingNominees.map((nominee) => `${nominee.categoryId}:${nominee.normalizedName}`));
  const plannedNomineeKeys = new Set<string>();
  let categoriesToCreate = 0, nomineesToCreate = 0, nomineesToUpdate = 0;
  for (const item of cleanItems) {
    const categoryKey = item.categoryName.toLowerCase();
    let categoryId = categoryByName.get(categoryKey);
    if (!categoryId) { if (!plannedCategoryNames.has(categoryKey)) { plannedCategoryNames.add(categoryKey); categoriesToCreate += 1; } categoryId = `new:${categoryKey}`; }
    if (!item.nomineeName) continue;
    const nomineeKey = `${categoryId}:${item.nomineeName.toLowerCase().replace(/\s+/g, " ")}`;
    if (plannedNomineeKeys.has(nomineeKey)) continue;
    plannedNomineeKeys.add(nomineeKey);
    if (existingNomineeKeys.has(nomineeKey)) nomineesToUpdate += 1; else nomineesToCreate += 1;
  }
  return { totalRows: validation.totalRows, validRows: cleanItems.length, categoriesToCreate, nomineesToCreate, nomineesToUpdate, duplicateRows: validation.duplicateRows, errors: validation.errors };
}

export async function bulkImportCategoriesAndNomineesAction(
  eventId: string,
  items: BulkImportItem[],
  existingBehavior: ImportExistingBehavior = "UPDATE",
  idempotencyKey?: string,
): Promise<BulkImportResult> {
  const { user } = await requireEventAccess(eventId, EVENT_ADMINS, "manage_events");

  const validation = validateBulkImportItems(items);
  const cleanItems = validation.valid;
  if (cleanItems.length === 0) throw new Error("No valid rows remain to import.");
  const key = idempotencyKey?.trim().toLowerCase();
  if (!key || !/^[a-f0-9]{64}$/.test(key)) throw new Error("A valid import idempotency key is required.");

  return await db.transaction(async (tx) => {
    const [claimed] = await tx.insert(importRuns).values({ eventId, requestedBy: user.id, idempotencyKey: key }).onConflictDoNothing().returning({ id: importRuns.id });
    if (!claimed) {
      const [previous] = await tx.select({ result: importRuns.result, completedAt: importRuns.completedAt }).from(importRuns).where(and(eq(importRuns.eventId, eventId), eq(importRuns.idempotencyKey, key))).limit(1);
      if (previous?.completedAt && previous.result) return previous.result as unknown as BulkImportResult;
      throw new Error("This import is already processing. Wait for it to complete before retrying.");
    }
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
    let nomineesUpdatedCount = 0;
    let nomineesSkippedCount = validation.errors.length;

    // 2. Process unique categories from import payload
    for (const item of cleanItems) {
      const catNameClean = item.categoryName;
      const catKey = catNameClean.toLowerCase();

      if (!categoryMap.has(catKey)) {
        maxCatOrder += 1;
        const [newCat] = await tx
          .insert(categories)
          .values({
            eventId,
            name: catNameClean,
            description: item.categoryDescription || "",
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
    const existingNominees = await tx.select().from(nominees).where(eq(nominees.eventId, eventId));
    for (const nominee of existingNominees) categoryNomineeOrderMap.set(nominee.categoryId, Math.max(categoryNomineeOrderMap.get(nominee.categoryId) ?? 0, nominee.displayOrder));

    // 3. Batch insert nominees under matching category IDs
    for (const item of cleanItems) {
      if (!item.nomineeName) continue;
      const catKey = item.categoryName.toLowerCase();
      const categoryId = categoryMap.get(catKey);

      if (categoryId) {
        const currentOrder = (categoryNomineeOrderMap.get(categoryId) || 0) + 1;
        categoryNomineeOrderMap.set(categoryId, currentOrder);

        const cleanName = item.nomineeName;
        const normalized = cleanName.toLowerCase().replace(/\s+/g, " ");

        const [existing] = await tx.select({ id: nominees.id }).from(nominees).where(and(eq(nominees.eventId, eventId), eq(nominees.categoryId, categoryId), eq(nominees.normalizedName, normalized))).limit(1);
        if (existing) {
          if (existingBehavior === "SKIP") {
            nomineesSkippedCount += 1;
            continue;
          }
          await tx.update(nominees).set({ name: normalizeCapitalization(cleanName), bio: item.nomineeBio || null, photoUrl: item.nomineePhotoUrl, status: "ACTIVE", updatedAt: new Date() }).where(eq(nominees.id, existing.id));
          nomineesUpdatedCount += 1;
          continue;
        }

        await tx.insert(nominees).values({
          eventId,
          categoryId,
          name: normalizeCapitalization(cleanName),
          normalizedName: normalized,
          bio: item.nomineeBio || null,
          photoUrl: item.nomineePhotoUrl,
          displayOrder: currentOrder,
          status: "ACTIVE",
          source: "MANUAL",
        });
        nomineesImportedCount += 1;
      }
    }

    const result = {
      success: true,
      categoriesCreated: categoriesCreatedCount,
      nomineesImported: nomineesImportedCount,
      nomineesUpdated: nomineesUpdatedCount,
      nomineesSkipped: nomineesSkippedCount,
      failedRows: validation.errors,
      totalProcessed: validation.totalRows,
    };
    await tx.update(importRuns).set({ result, completedAt: new Date() }).where(eq(importRuns.id, claimed.id));
    return result;
  });
}
