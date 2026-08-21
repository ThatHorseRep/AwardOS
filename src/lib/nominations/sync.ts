import { db } from "@/lib/db";
import { categories, nominations, nominees } from "@/lib/db/schema";
import { eq, and, sql, isNull, inArray } from "drizzle-orm";
import { normalizeCapitalization } from "@/lib/ai/cleanup";

/**
 * Promote an event's raw nomination text into de-duplicated `nominees` rows and
 * point each nomination at the nominee it resolved to.
 *
 * This lives outside `src/actions` on purpose. The public nomination endpoint
 * has to run it for anonymous visitors, but every export of a `"use server"`
 * module is a callable endpoint, so exposing an unguarded action there would
 * hand anyone a way to trigger this against an arbitrary eventId. Keeping the
 * work in a plain module lets the server action keep its workspace guard while
 * the route calls straight through.
 *
 * Callers are responsible for authorization: the action wrapper checks
 * workspace membership, and the public route only reaches here after resolving
 * a live, non-deleted event from the slug in the URL.
 *
 * Every query below is scoped to `eventId`, so it cannot touch another event's
 * rows even if handed an id from elsewhere.
 */
export async function syncNomineesForEvent(eventId: string) {
  const eventCategories = await db
    .select()
    .from(categories)
    .where(and(eq(categories.eventId, eventId), eq(categories.isActive, true)));

  if (!eventCategories.length) {
    return { createdCount: 0, linkedCount: 0 };
  }

  // Only the authoritative latest version of each submission may drive the
  // ballot roster. Without this filter a superseded version (an edit that
  // renamed the nominee) still resolves into its own ACTIVE nominee with zero
  // latest nominations behind it — a phantom entry on the public ballot — and
  // a deleted nominee could be resurrected from those stale rows.
  const unresolvedNominations = await db
    .select({ categoryId: nominations.categoryId, nomineeText: nominations.nomineeText })
    .from(nominations)
    .where(
      and(
        eq(nominations.eventId, eventId),
        eq(nominations.isLatest, true),
        isNull(nominations.resolvedNomineeId)
      )
    );

  if (!unresolvedNominations.length) {
    return { createdCount: 0, linkedCount: 0 };
  }

  const activeNominees = await db
    .select({ id: nominees.id, categoryId: nominees.categoryId, normalizedName: nominees.normalizedName })
    .from(nominees)
    .where(and(eq(nominees.eventId, eventId), eq(nominees.status, "ACTIVE")));

  const activeNomineesByCategory = new Map<string, Map<string, string>>();
  for (const item of activeNominees) {
    const normalizedKey = item.normalizedName.trim().toLowerCase();
    const categoryMap = activeNomineesByCategory.get(item.categoryId) ?? new Map();
    categoryMap.set(normalizedKey, item.id);
    activeNomineesByCategory.set(item.categoryId, categoryMap);
  }

  const nominationGroupsByCategory = new Map<
    string,
    Map<
      string,
      { canonicalName: string; sourceTexts: Set<string>; count: number }
    >
  >();

  for (const nomination of unresolvedNominations) {
    const normalizedName = normalizeCapitalization(nomination.nomineeText || "");
    if (!normalizedName) continue;

    const normalizedKey = normalizedName.trim().toLowerCase();
    if (!normalizedKey) continue;

    const categoryGroups = nominationGroupsByCategory.get(nomination.categoryId) ?? new Map();
    const existingGroup = categoryGroups.get(normalizedKey);

    if (existingGroup) {
      existingGroup.sourceTexts.add(nomination.nomineeText);
      existingGroup.count += 1;
    } else {
      categoryGroups.set(normalizedKey, {
        canonicalName: normalizedName,
        sourceTexts: new Set([nomination.nomineeText]),
        count: 1,
      });
    }

    nominationGroupsByCategory.set(nomination.categoryId, categoryGroups);
  }

  if (!nominationGroupsByCategory.size) {
    return { createdCount: 0, linkedCount: 0 };
  }

  return await db.transaction(async (tx) => {
    // Serialise syncs for this event. Two nominations naming the same person
    // can be submitted concurrently, and both post-submit syncs would read the
    // same unresolved set under READ COMMITTED: with no unique constraint on
    // (event_id, category_id, normalized_name) each transaction would insert
    // its own copy of the nominee, putting duplicate entries on the public
    // ballot and splitting votes. The per-event advisory lock makes the second
    // sync wait, after which it finds nothing left to resolve.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${eventId}))`);

    let createdCount = 0;
    let linkedCount = 0;

    for (const [categoryId, groupMap] of nominationGroupsByCategory.entries()) {
      const existingCategoryNominees = activeNomineesByCategory.get(categoryId) ?? new Map();
      const nomineesToInsert: Array<{
        eventId: string;
        categoryId: string;
        name: string;
        normalizedName: string;
        displayOrder: number;
        status: "ACTIVE";
        source: "NOMINATION";
        nominationCount: number;
      }> = [];

      const maxOrderResult = await tx
        .select({ maxOrder: sql<number>`max(${nominees.displayOrder})` })
        .from(nominees)
        .where(eq(nominees.categoryId, categoryId));

      let nextOrder = (maxOrderResult[0]?.maxOrder || 0) + 1;

      const groupedInsertMeta: Array<{
        normalizedKey: string;
        sourceTexts: string[];
        count: number;
      }> = [];

      for (const [normalizedKey, group] of groupMap.entries()) {
        if (existingCategoryNominees.has(normalizedKey)) {
          const nomineeId = existingCategoryNominees.get(normalizedKey)!;
          await tx
            .update(nominees)
            .set({ nominationCount: sql`${nominees.nominationCount} + ${group.count}`, updatedAt: new Date() })
            .where(eq(nominees.id, nomineeId));

          await tx
            .update(nominations)
            .set({ resolvedNomineeId: nomineeId })
            .where(
              and(
                eq(nominations.eventId, eventId),
                eq(nominations.categoryId, categoryId),
                inArray(nominations.nomineeText, Array.from(group.sourceTexts))
              )
            );

          linkedCount += group.count;
          continue;
        }

        nomineesToInsert.push({
          eventId,
          categoryId,
          name: group.canonicalName,
          normalizedName: normalizedKey,
          displayOrder: nextOrder++,
          status: "ACTIVE",
          source: "NOMINATION",
          nominationCount: group.count,
        });

        groupedInsertMeta.push({
          normalizedKey,
          sourceTexts: Array.from(group.sourceTexts),
          count: group.count,
        });
      }

      if (nomineesToInsert.length > 0) {
        const insertedRows = await tx
          .insert(nominees)
          .values(nomineesToInsert)
          .returning({ id: nominees.id, normalizedName: nominees.normalizedName, categoryId: nominees.categoryId });

        for (const inserted of insertedRows) {
          const normalizedKey = inserted.normalizedName.trim().toLowerCase();
          const insertMeta = groupedInsertMeta.find((item) => item.normalizedKey === normalizedKey);
          if (!insertMeta) continue;

          await tx
            .update(nominations)
            .set({ resolvedNomineeId: inserted.id })
            .where(
              and(
                eq(nominations.eventId, eventId),
                eq(nominations.categoryId, inserted.categoryId),
                inArray(nominations.nomineeText, insertMeta.sourceTexts)
              )
            );

          createdCount += insertMeta.count;
          linkedCount += insertMeta.count;
        }
      }
    }

    // Retire nomination-sourced nominees that no longer have a single latest
    // version behind them. The canonical case: a voter edits "Alice" to
    // "Alicia" — Alice was a real nominee when created, but after the
    // resubmission nothing latest resolves to it, so leaving it ACTIVE would
    // put a zero-nomination phantom on the public ballot. Only nominees this
    // sync pipeline itself created (source NOMINATION) are retired; MANUAL and
    // AI_SUGGESTED entries are organizer decisions and are never touched.
    // A name that returns in a future submission is simply re-created here.
    await tx.execute(sql`
      UPDATE nominees SET status = 'REMOVED', updated_at = now()
      WHERE event_id = ${eventId} AND status = 'ACTIVE' AND source = 'NOMINATION'
        AND NOT EXISTS (
          SELECT 1 FROM nominations
          WHERE resolved_nominee_id = nominees.id AND is_latest = true
        )
    `);

    return { createdCount, linkedCount };
  });
}
