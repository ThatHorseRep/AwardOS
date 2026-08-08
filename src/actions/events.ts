"use server";

import { db } from "@/lib/db";
import { events, categories, nominees, workflowStages, eventBranding, nominations, votes } from "@/lib/db/schema";
import { getOrCreateWorkspaceAction } from "./workspaces";
import { requireWorkspaceRole, requireEventAccess, EVENT_ADMINS, WORKSPACE_ADMINS } from "./_rbac";
import { eq, and, isNull, count, sql, lt } from "drizzle-orm";
import { syncNomineesForEvent } from "@/lib/nominations/sync";
import { redirect } from "next/navigation";

export interface CreateEventInput {
  name: string;
  slug: string;
  description?: string;
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  nominationStart?: string;
  nominationEnd?: string;
  votingStart?: string;
  votingEnd?: string;
  categories: { name: string; description?: string }[];
  verificationLevel: "STANDARD" | "ADVANCED";
  audienceType: "PUBLIC" | "STUDENTS" | "FACULTY" | "ALUMNI" | "INVITE_ONLY" | "MEMBERS";
}

export async function createEventAction(input: CreateEventInput) {
  const { user, workspace } = await requireWorkspaceRole(EVENT_ADMINS);

  const newEventId = await db.transaction(async (tx) => {
    // 1. Insert Event
    const [event] = await tx
      .insert(events)
      .values({
        workspaceId: workspace.id,
        name: input.name,
        slug: input.slug,
        description: input.description || "",
        status: "DRAFT",
        visibility: input.visibility,
        verificationLevel: input.verificationLevel,
        audienceType: input.audienceType,
        createdBy: user.id,
      })
      .returning();

    // 2. Insert Event Branding placeholder
    await tx.insert(eventBranding).values({
      eventId: event.id,
      primaryColor: "#6366f1",
      secondaryColor: "#1e293b",
      accentColor: "#8b5cf6",
    });

    // 3. Insert default workflow stages with dates
    const stages = [
      {
        stageType: "CREATION" as const,
        displayName: "Event Setup",
        displayOrder: 1,
        status: "COMPLETED" as const,
      },
      {
        stageType: "NOMINATIONS" as const,
        displayName: "Nominations Stage",
        displayOrder: 2,
        status: "PENDING" as const,
        startsAt: input.nominationStart ? new Date(input.nominationStart) : null,
        endsAt: input.nominationEnd ? new Date(input.nominationEnd) : null,
      },
      {
        stageType: "SCREENING" as const,
        displayName: "AI screening & review",
        displayOrder: 3,
        status: "PENDING" as const,
      },
      {
        stageType: "VOTING" as const,
        displayName: "Voting Stage",
        displayOrder: 4,
        status: "PENDING" as const,
        startsAt: input.votingStart ? new Date(input.votingStart) : null,
        endsAt: input.votingEnd ? new Date(input.votingEnd) : null,
      },
      {
        stageType: "OFFICIAL_RESULTS" as const,
        displayName: "Results & Overview",
        displayOrder: 5,
        status: "PENDING" as const,
      },
      {
        stageType: "COMMUNITY_ARCHIVE" as const,
        displayName: "Archived & Public",
        displayOrder: 6,
        status: "PENDING" as const,
      },
    ];

    for (const stage of stages) {
      await tx.insert(workflowStages).values({
        eventId: event.id,
        stageType: stage.stageType,
        displayName: stage.displayName,
        displayOrder: stage.displayOrder,
        status: stage.status,
        startsAt: stage.startsAt,
        endsAt: stage.endsAt,
      });
    }

    // 4. Insert Categories
    if (input.categories && input.categories.length > 0) {
      for (let idx = 0; idx < input.categories.length; idx++) {
        const cat = input.categories[idx];
        await tx.insert(categories).values({
          eventId: event.id,
          name: cat.name,
          description: cat.description || "",
          displayOrder: idx + 1,
        });
      }
    }

    return event.id;
  });

  return { success: true, eventId: newEventId };
}

export async function getEventsAction() {
  const workspace = await getOrCreateWorkspaceAction();
  if (!workspace) {
    return [];
  }

  return await db
    .select()
    .from(events)
    .where(and(eq(events.workspaceId, workspace.id), isNull(events.deletedAt)))
    .orderBy(events.createdAt);
}

export async function getEventDetailsAction(eventId: string) {
  const workspace = await getOrCreateWorkspaceAction();
  if (!workspace) {
    throw new Error("No active workspace");
  }

  const eventList = await db
    .select()
    .from(events)
    // isNull(deletedAt) mirrors requireEventAccess: a soft-deleted event is not
    // addressable, and without it a deleted event stayed fully readable by id.
    .where(
      and(
        eq(events.id, eventId),
        eq(events.workspaceId, workspace.id),
        isNull(events.deletedAt)
      )
    )
    .limit(1);

  if (eventList.length === 0) {
    return null;
  }

  const event = eventList[0];

  // Fetch categories with nomination counts, incoming nominations, and official nominees
  const eventCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.eventId, event.id))
    .orderBy(categories.displayOrder);

  const categoriesWithDetails = await Promise.all(
    eventCategories.map(async (cat) => {
      const nomList = await db
        .select()
        .from(nominations)
        .where(eq(nominations.categoryId, cat.id))
        .orderBy(nominations.createdAt);

      const nomineeList = await db
        .select()
        .from(nominees)
        .where(eq(nominees.categoryId, cat.id))
        .orderBy(nominees.displayOrder);

      return {
        ...cat,
        count: nomList.length,
        incomingNominations: nomList,
        nominees: nomineeList,
      };
    })
  );

  // Fetch workflow stages
  const stages = await db
    .select()
    .from(workflowStages)
    .where(eq(workflowStages.eventId, event.id))
    .orderBy(workflowStages.displayOrder);

  // Fetch branding
  const brandingList = await db
    .select()
    .from(eventBranding)
    .where(eq(eventBranding.eventId, event.id))
    .limit(1);
  const branding = brandingList[0] || null;

  // Fetch event-level counts
  const nomCountResult = await db
    .select({ val: count() })
    .from(nominations)
    .where(eq(nominations.eventId, event.id));
  const nominationsCount = nomCountResult[0]?.val || 0;

  const votesCountResult = await db
    .select({ val: count() })
    .from(votes)
    .where(eq(votes.eventId, event.id));
  const votesCount = votesCountResult[0]?.val || 0;

  return {
    ...event,
    categories: categoriesWithDetails,
    stages,
    branding,
    nominationsCount,
    votesCount,
  };
}

export async function updateEventTimelineAction(
  eventId: string,
  stageUpdates: { stageId: string; startsAt?: string | null; endsAt?: string | null }[]
) {
  await requireEventAccess(eventId, EVENT_ADMINS);

  for (const update of stageUpdates) {
    await db
      .update(workflowStages)
      .set({
        startsAt: update.startsAt ? new Date(update.startsAt) : null,
        endsAt: update.endsAt ? new Date(update.endsAt) : null,
      })
      .where(and(eq(workflowStages.id, update.stageId), eq(workflowStages.eventId, eventId)));
  }

  return { success: true };
}

export async function deleteEventAction(eventId: string) {
  const { workspace } = await requireWorkspaceRole(EVENT_ADMINS);

  await db
    .update(events)
    .set({ deletedAt: new Date() })
    .where(and(eq(events.id, eventId), eq(events.workspaceId, workspace.id)));

  return { success: true };
}

export async function getPublicEventDetailsAction(slug: string) {
  const eventList = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, slug), isNull(events.deletedAt)))
    .limit(1);

  if (eventList.length === 0) {
    return null;
  }

  const event = eventList[0];

  // A PRIVATE event is not addressable by slug — treat it as absent rather than
  // confirming it exists to anyone who guesses the URL.
  if (event.visibility === "PRIVATE") {
    return null;
  }

  // Fetch categories & nominees for public view
  const eventCategories = await db
    .select()
    .from(categories)
    .where(and(eq(categories.eventId, event.id), eq(categories.isActive, true)))
    .orderBy(categories.displayOrder);

  // Was `ensureNomineesForRawNominationsAction`, which calls
  // requireWorkspaceRole and therefore threw for every signed-out visitor —
  // breaking the public event and nomination pages for exactly the people they
  // exist for. syncNomineesForEvent is the unguarded library function the
  // nominations route already uses for this.
  await syncNomineesForEvent(event.id);

  const categoriesWithNominees = await Promise.all(
    eventCategories.map(async (cat) => {
      const nomineeList = await db
        .select()
        .from(nominees)
        .where(and(eq(nominees.categoryId, cat.id), eq(nominees.status, "ACTIVE")))
        .orderBy(nominees.displayOrder);

      return {
        ...cat,
        nominees: nomineeList,
      };
    })
  );

  // Fetch workflow stages
  const stages = await db
    .select()
    .from(workflowStages)
    .where(eq(workflowStages.eventId, event.id))
    .orderBy(workflowStages.displayOrder);

  // Fetch branding
  const brandingList = await db
    .select()
    .from(eventBranding)
    .where(eq(eventBranding.eventId, event.id))
    .limit(1);
  const branding = brandingList[0] || null;

  return {
    id: event.id,
    name: event.name,
    slug: event.slug,
    description: event.description,
    status: event.status,
    verificationLevel: event.verificationLevel,
    liveResultsMode: event.liveResultsMode,
    categories: categoriesWithNominees,
    stages,
    branding,
  };
}

export interface UpdateEventBrandingInput {
  eventId: string;
  logoUrl?: string;
  bannerUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
}

export async function updateEventBrandingAction(input: UpdateEventBrandingInput) {
  // requireWorkspaceRole alone proved the caller holds a role in *their own*
  // workspace, then this wrote keyed only on the caller-supplied eventId — so
  // any event manager could rewrite the logo, banner and colours of any event
  // in any workspace. requireEventAccess binds the id to the caller's workspace.
  await requireEventAccess(input.eventId, EVENT_ADMINS);

  const existing = await db
    .select()
    .from(eventBranding)
    .where(eq(eventBranding.eventId, input.eventId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(eventBranding).values({
      eventId: input.eventId,
      logoUrl: input.logoUrl || "",
      bannerUrl: input.bannerUrl || "",
      primaryColor: input.primaryColor || "#6366f1",
      secondaryColor: input.secondaryColor || "#4f46e5",
      accentColor: input.accentColor || "#f59e0b",
    });
  } else {
    await db
      .update(eventBranding)
      .set({
        logoUrl: input.logoUrl !== undefined ? input.logoUrl : existing[0].logoUrl,
        bannerUrl: input.bannerUrl !== undefined ? input.bannerUrl : existing[0].bannerUrl,
        primaryColor: input.primaryColor !== undefined ? input.primaryColor : existing[0].primaryColor,
        secondaryColor: input.secondaryColor !== undefined ? input.secondaryColor : existing[0].secondaryColor,
        accentColor: input.accentColor !== undefined ? input.accentColor : existing[0].accentColor,
        updatedAt: new Date(),
      })
      .where(eq(eventBranding.eventId, input.eventId));
  }

  return { success: true };
}

export async function duplicateEventAction(eventId: string, newName: string, newSlug: string) {
  // Was scoped only by role, while the parent was fetched by bare id — so this
  // cloned another workspace's event, wrote the copy into *their* workspace,
  // and returned their row (description, visibility, verification and audience
  // config) to the caller.
  const { user, event: parent } = await requireEventAccess(eventId, EVENT_ADMINS);

  // 2. Perform deep duplication in a transaction
  const newEvent = await db.transaction(async (tx) => {
    // A. Insert cloned event record
    const [cloned] = await tx
      .insert(events)
      .values({
        workspaceId: parent.workspaceId,
        name: newName,
        slug: newSlug,
        description: parent.description,
        status: "DRAFT",
        visibility: parent.visibility,
        verificationLevel: parent.verificationLevel,
        verificationConfig: parent.verificationConfig,
        audienceType: parent.audienceType,
        audienceConfig: parent.audienceConfig,
        liveResultsMode: "HIDDEN",
        createdBy: user.id,
      })
      .returning();

    // B. Copy branding if exists
    const brandingList = await tx
      .select()
      .from(eventBranding)
      .where(eq(eventBranding.eventId, parent.id))
      .limit(1);

    if (brandingList.length > 0) {
      const b = brandingList[0];
      await tx.insert(eventBranding).values({
        eventId: cloned.id,
        logoUrl: b.logoUrl,
        bannerUrl: b.bannerUrl,
        flyerUrl: b.flyerUrl,
        backgroundUrl: b.backgroundUrl,
        ogImageUrl: b.ogImageUrl,
        primaryColor: b.primaryColor,
        secondaryColor: b.secondaryColor,
        accentColor: b.accentColor,
      });
    }

    // C. Copy categories and their nominees
    const parentCategories = await tx
      .select()
      .from(categories)
      .where(eq(categories.eventId, parent.id))
      .orderBy(categories.displayOrder);

    for (const cat of parentCategories) {
      const [newCat] = await tx
        .insert(categories)
        .values({
          eventId: cloned.id,
          name: cat.name,
          description: cat.description,
          eligibility: cat.eligibility,
          displayOrder: cat.displayOrder,
          maxNomineesPerVoter: cat.maxNomineesPerVoter,
          isActive: cat.isActive,
        })
        .returning();

      // Find and copy nominees in this category
      const parentNominees = await tx
        .select()
        .from(nominees)
        .where(eq(nominees.categoryId, cat.id))
        .orderBy(nominees.displayOrder);

      for (const nom of parentNominees) {
        await tx.insert(nominees).values({
          eventId: cloned.id,
          categoryId: newCat.id,
          name: nom.name,
          normalizedName: nom.normalizedName,
          photoUrl: nom.photoUrl,
          bio: nom.bio,
          displayOrder: nom.displayOrder,
          status: "ACTIVE",
          source: nom.source,
          nominationCount: 0,
        });
      }
    }

    // D. Copy workflow stages
    const parentStages = await tx
      .select()
      .from(workflowStages)
      .where(eq(workflowStages.eventId, parent.id))
      .orderBy(workflowStages.displayOrder);

    for (const stage of parentStages) {
      await tx.insert(workflowStages).values({
        eventId: cloned.id,
        stageType: stage.stageType,
        displayName: stage.displayName,
        displayOrder: stage.displayOrder,
        status: "PENDING",
        startsAt: stage.startsAt,
        endsAt: stage.endsAt,
        autoTransition: stage.autoTransition,
        config: stage.config,
      });
    }

    return cloned;
  });

  return newEvent;
}

export async function updateWorkflowStageStatusAction(
  eventId: string,
  stageId: string,
  newStatus: "PENDING" | "ACTIVE" | "COMPLETED" | "SKIPPED"
) {
  await requireEventAccess(eventId, EVENT_ADMINS);

  return await db.transaction(async (tx) => {
    // 1. Get target stage
    const stageList = await tx
      .select()
      .from(workflowStages)
      .where(and(eq(workflowStages.id, stageId), eq(workflowStages.eventId, eventId)))
      .limit(1);

    if (stageList.length === 0) {
      throw new Error("Stage not found");
    }

    const targetStage = stageList[0];

    // If activating this stage, mark previously active stage as COMPLETED
    if (newStatus === "ACTIVE") {
      await tx
        .update(workflowStages)
        .set({ status: "COMPLETED" })
        .where(
          and(
            eq(workflowStages.eventId, eventId),
            lt(workflowStages.displayOrder, targetStage.displayOrder),
            eq(workflowStages.status, "ACTIVE")
          )
        );
    }

    // Update target stage
    await tx
      .update(workflowStages)
      .set({
        status: newStatus,
      })
      .where(eq(workflowStages.id, stageId));

    // Sync overall event status if needed
    if (newStatus === "ACTIVE") {
      let eventStatusToSet: "ACTIVE" | "COMPLETED" = "ACTIVE";
      if (targetStage.stageType === "OFFICIAL_RESULTS" || targetStage.stageType === "COMMUNITY_ARCHIVE") {
        eventStatusToSet = "COMPLETED";
      }

      await tx
        .update(events)
        .set({ status: eventStatusToSet, updatedAt: new Date() })
        .where(eq(events.id, eventId));
    }

    return { success: true };
  });
}

export async function updateBallotSettingsAction(input: {
  eventId: string;
  verificationMethod?: "NONE" | "EMAIL_OTP" | "INVITATION_CODE";
  verificationLevel?: "STANDARD" | "ADVANCED";
  visibility?: "PUBLIC" | "UNLISTED" | "PRIVATE";
  liveResultsMode?: "FULL_LEADERBOARD" | "PERCENTAGES" | "VOTE_COUNTS" | "HIDDEN";
  audienceType?: "PUBLIC" | "STUDENTS" | "FACULTY" | "ALUMNI" | "INVITE_ONLY" | "MEMBERS";
}) {
  // Ballot configuration governs who may vote — workspace admins only.
  const { workspace } = await requireWorkspaceRole(WORKSPACE_ADMINS);

  await db
    .update(events)
    .set({
      ...(input.verificationLevel && { verificationLevel: input.verificationLevel }),
      ...(input.visibility && { visibility: input.visibility }),
      ...(input.liveResultsMode && { liveResultsMode: input.liveResultsMode }),
      ...(input.audienceType && { audienceType: input.audienceType }),
      ...(input.verificationMethod && {
        verificationConfig: {
          method: input.verificationMethod,
        },
      }),
      updatedAt: new Date(),
    })
    .where(and(eq(events.id, input.eventId), eq(events.workspaceId, workspace.id)));

  return { success: true };
}

