"use server";

import { db } from "@/lib/db";
import {
  events,
  categories,
  nominees,
  workflowStages,
  eventBranding,
  nominations,
  voteSessions,
  auditLogs,
  archiveConfigs,
} from "@/lib/db/schema";
import { getOrCreateWorkspaceAction } from "./workspaces";
import {
  requireWorkspaceRole,
  requireEventAccess,
  EVENT_ADMINS,
  WORKSPACE_ADMINS,
} from "./_rbac";
import { eq, and, isNull, count, lt, sql, inArray } from "drizzle-orm";
import { getEventVoteAccounting } from "@/lib/voting/accounting";
import { z } from "zod";
import { evaluateWorkflowWindow } from "@/lib/workflow/policy";
import { issueWorkflowStartToken } from "@/lib/workflow/start-token";
import { sanitizePlainText } from "@/lib/sanitize";
import {
  getBallotRosterHash,
  getInvalidBallotCategoryNames,
} from "@/lib/ballot-review";

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
  audienceType:
    "PUBLIC" | "STUDENTS" | "FACULTY" | "ALUMNI" | "INVITE_ONLY" | "MEMBERS";
}

const createEventInputSchema = z
  .object({
    name: z.string().trim().min(3).max(150),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .min(3)
      .max(100),
    description: z.string().max(5000).optional(),
    visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]),
    nominationStart: z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)))
      .optional(),
    nominationEnd: z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)))
      .optional(),
    votingStart: z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)))
      .optional(),
    votingEnd: z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)))
      .optional(),
    categories: z
      .array(
        z.object({
          name: z.string().trim().min(2).max(150),
          description: z.string().max(1000).optional(),
        }),
      )
      .max(100),
    verificationLevel: z.enum(["STANDARD", "ADVANCED"]),
    audienceType: z.enum([
      "PUBLIC",
      "STUDENTS",
      "FACULTY",
      "ALUMNI",
      "INVITE_ONLY",
      "MEMBERS",
    ]),
  })
  .superRefine((data, ctx) => {
    const categoryNames = data.categories.map((category) =>
      category.name.toLowerCase(),
    );
    if (new Set(categoryNames).size !== categoryNames.length)
      ctx.addIssue({
        code: "custom",
        path: ["categories"],
        message: "Category names must be unique within the event.",
      });
    const pairs = [
      [data.nominationStart, data.nominationEnd, "nomination"],
      [data.votingStart, data.votingEnd, "voting"],
    ] as const;
    for (const [start, end, label] of pairs)
      if (
        (start && !end) ||
        (!start && end) ||
        (start && end && new Date(start) >= new Date(end))
      )
        ctx.addIssue({
          code: "custom",
          path: [label === "nomination" ? "nominationEnd" : "votingEnd"],
          message: `Set a valid ${label} start and end time.`,
        });
    if (
      data.nominationEnd &&
      data.votingStart &&
      new Date(data.nominationEnd) > new Date(data.votingStart)
    )
      ctx.addIssue({
        code: "custom",
        path: ["votingStart"],
        message: "Voting cannot open before nominations close.",
      });
  });

export async function createEventAction(input: CreateEventInput) {
  const { user, workspace } = await requireWorkspaceRole(EVENT_ADMINS, "manage_events");
  const parsed = createEventInputSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(
      parsed.error.issues[0]?.message ?? "Event details are invalid.",
    );
  const data = parsed.data;

  const newEventId = await db.transaction(async (tx) => {
    // 1. Insert Event
    const [event] = await tx
      .insert(events)
      .values({
        workspaceId: workspace.id,
        name: sanitizePlainText(data.name, 150),
        slug: data.slug,
        description: sanitizePlainText(data.description ?? "", 5000),
        status: "DRAFT",
        visibility: data.visibility,
        verificationLevel: data.verificationLevel,
        audienceType: data.audienceType,
        createdBy: user.id,
      })
      .returning();

    // 2. Insert the event's default branding record.
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
        startsAt: data.nominationStart ? new Date(data.nominationStart) : null,
        endsAt: data.nominationEnd ? new Date(data.nominationEnd) : null,
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
        startsAt: data.votingStart ? new Date(data.votingStart) : null,
        endsAt: data.votingEnd ? new Date(data.votingEnd) : null,
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
    if (data.categories.length > 0) {
      for (let idx = 0; idx < data.categories.length; idx++) {
        const cat = data.categories[idx];
        await tx.insert(categories).values({
          eventId: event.id,
          name: sanitizePlainText(cat.name, 150),
          description: sanitizePlainText(cat.description ?? "", 1000),
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
        isNull(events.deletedAt),
      ),
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
    }),
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

  const voteAccounting = await getEventVoteAccounting(event.id);

  return {
    ...event,
    categories: categoriesWithDetails,
    stages,
    branding,
    nominationsCount,
    voteAccounting,
  };
}

export async function updateEventTimelineAction(
  eventId: string,
  stageUpdates: {
    stageId: string;
    startsAt?: string | null;
    endsAt?: string | null;
  }[],
) {
  await requireEventAccess(eventId, EVENT_ADMINS, "manage_events");

  for (const update of stageUpdates) {
    await db
      .update(workflowStages)
      .set({
        startsAt: update.startsAt ? new Date(update.startsAt) : null,
        endsAt: update.endsAt ? new Date(update.endsAt) : null,
      })
      .where(
        and(
          eq(workflowStages.id, update.stageId),
          eq(workflowStages.eventId, eventId),
        ),
      );
  }

  return { success: true };
}

export async function deleteEventAction(
  eventId: string,
  confirmationName: string,
  confirmPublished = false,
) {
  const { user, workspace, event } = await requireEventAccess(
    eventId,
    EVENT_ADMINS,
  );
  if (confirmationName.trim() !== event.name)
    throw new Error("Enter the event name exactly to confirm deletion.");
  const voteAccounting = await getEventVoteAccounting(eventId);
  const submittedBallots = voteAccounting.submittedBallots;
  if (
    (event.status === "ACTIVE" ||
      event.status === "COMPLETED" ||
      submittedBallots > 0) &&
    !confirmPublished
  )
    throw new Error(
      "Confirm that you understand this published or voted event will be removed from public access.",
    );
  const deletedAt = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(events)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(
        and(
          eq(events.id, eventId),
          eq(events.workspaceId, workspace.id),
          isNull(events.deletedAt),
        ),
      );
    await tx
      .insert(auditLogs)
      .values({
        workspaceId: workspace.id,
        eventId,
        actorId: user.id,
        action: "event.deleted",
        targetType: "event",
        targetId: eventId,
        details: {
          recoverableUntil: new Date(
            deletedAt.getTime() + 30 * 86400000,
          ).toISOString(),
          submittedBallots,
        },
      });
  });
  return {
    success: true,
    recoverableUntil: new Date(
      deletedAt.getTime() + 30 * 86400000,
    ).toISOString(),
  };
}

export async function getDeletedEventsAction() {
  const { workspace } = await requireWorkspaceRole(EVENT_ADMINS, "manage_events");
  return db
    .select()
    .from(events)
    .where(
      and(
        eq(events.workspaceId, workspace.id),
        sql`${events.deletedAt} is not null`,
      ),
    )
    .orderBy(events.deletedAt);
}

export async function restoreDeletedEventAction(eventId: string) {
  const { user, workspace } = await requireWorkspaceRole(EVENT_ADMINS, "manage_events");
  const [event] = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.id, eventId),
        eq(events.workspaceId, workspace.id),
        sql`${events.deletedAt} is not null`,
      ),
    )
    .limit(1);
  if (!event?.deletedAt) throw new Error("Deleted event not found.");
  if (Date.now() - event.deletedAt.getTime() > 30 * 86400000)
    throw new Error("This event's 30-day recovery window has expired.");
  await db.transaction(async (tx) => {
    await tx
      .update(events)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(events.id, eventId));
    await tx
      .insert(auditLogs)
      .values({
        workspaceId: workspace.id,
        eventId,
        actorId: user.id,
        action: "event.restored",
        targetType: "event",
        targetId: eventId,
      });
  });
  return { success: true };
}

export async function purgeDeletedEventAction(
  eventId: string,
  confirmationName: string,
) {
  const { user, workspace } = await requireWorkspaceRole(EVENT_ADMINS, "manage_events");
  const [event] = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.id, eventId),
        eq(events.workspaceId, workspace.id),
        sql`${events.deletedAt} is not null`,
      ),
    )
    .limit(1);
  if (!event?.deletedAt) throw new Error("Deleted event not found.");
  if (confirmationName.trim() !== event.name)
    throw new Error(
      "Enter the event name exactly to confirm permanent deletion.",
    );
  if (Date.now() - event.deletedAt.getTime() < 30 * 86400000)
    throw new Error(
      "Permanent deletion is available after the 30-day recovery window.",
    );
  const [archive] = await db.select({ isPublic: archiveConfigs.isPublic }).from(archiveConfigs).where(eq(archiveConfigs.eventId, eventId)).limit(1);
  if (archive?.isPublic) throw new Error("Unpublish this event from the public archive before permanent deletion.");
  await db.transaction(async (tx) => {
    await tx
      .insert(auditLogs)
      .values({
        workspaceId: workspace.id,
        actorId: user.id,
        action: "event.purged",
        targetType: "event",
        targetId: eventId,
        details: { name: event.name },
      });
    await tx
      .delete(events)
      .where(and(eq(events.id, eventId), eq(events.workspaceId, workspace.id)));
  });
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

  // Public reads must remain side-effect free. Nominee synchronization happens
  // at nomination submission and explicit organizer cleanup boundaries.
  const categoryIds = eventCategories.map((category) => category.id);
  const nomineeRows = categoryIds.length
    ? await db
        .select()
        .from(nominees)
        .where(and(inArray(nominees.categoryId, categoryIds), eq(nominees.status, "ACTIVE")))
        .orderBy(nominees.displayOrder)
    : [];
  const nomineesByCategory = new Map<string, typeof nomineeRows>();
  for (const nominee of nomineeRows) {
    const list = nomineesByCategory.get(nominee.categoryId) ?? [];
    list.push(nominee);
    nomineesByCategory.set(nominee.categoryId, list);
  }
  const categoriesWithNominees = eventCategories.map((category) => ({
    ...category,
    nominees: nomineesByCategory.get(category.id) ?? [],
  }));

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
  const nominationWindow = evaluateWorkflowWindow({
    eventStatus: event.status,
    stage: stages.find((stage) => stage.stageType === "NOMINATIONS"),
    now: new Date(),
  });

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
    nominationStartToken: nominationWindow.allowed
      ? issueWorkflowStartToken({ eventId: event.id, stageType: "NOMINATIONS", startedAt: new Date().toISOString() })
      : null,
  };
}

export interface UpdateEventBrandingInput {
  eventId: string;
  logoUrl?: string;
  bannerUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  ogImageUrl?: string;
}

const brandingColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color.");
const brandingUrlSchema = z.union([
  z.literal(""),
  z.string().url().refine((value) => value.startsWith("https://"), "Brand images must use HTTPS."),
]);

const eventBrandingSchema = z.object({
  eventId: z.string().uuid(),
  logoUrl: brandingUrlSchema.optional(),
  bannerUrl: brandingUrlSchema.optional(),
  primaryColor: brandingColorSchema.optional(),
  secondaryColor: brandingColorSchema.optional(),
  accentColor: brandingColorSchema.optional(),
  ogImageUrl: brandingUrlSchema.optional(),
});

export async function updateEventBrandingAction(
  input: UpdateEventBrandingInput,
) {
  const data = eventBrandingSchema.parse(input);
  // requireWorkspaceRole alone proved the caller holds a role in *their own*
  // workspace, then this wrote keyed only on the caller-supplied eventId — so
  // any event manager could rewrite the logo, banner and colours of any event
  // in any workspace. requireEventAccess binds the id to the caller's workspace.
  await requireEventAccess(data.eventId, EVENT_ADMINS, "manage_branding");

  const existing = await db
    .select()
    .from(eventBranding)
    .where(eq(eventBranding.eventId, data.eventId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(eventBranding).values({
      eventId: data.eventId,
      logoUrl: data.logoUrl || "",
      bannerUrl: data.bannerUrl || "",
      primaryColor: data.primaryColor || "#6366f1",
      secondaryColor: data.secondaryColor || "#4f46e5",
      accentColor: data.accentColor || "#f59e0b",
      ogImageUrl: data.ogImageUrl || "",
    });
  } else {
    await db
      .update(eventBranding)
      .set({
        logoUrl:
          data.logoUrl !== undefined ? data.logoUrl : existing[0].logoUrl,
        bannerUrl:
          data.bannerUrl !== undefined
            ? data.bannerUrl
            : existing[0].bannerUrl,
        primaryColor:
          data.primaryColor !== undefined
            ? data.primaryColor
            : existing[0].primaryColor,
        secondaryColor:
          data.secondaryColor !== undefined
            ? data.secondaryColor
            : existing[0].secondaryColor,
        accentColor:
          data.accentColor !== undefined
            ? data.accentColor
            : existing[0].accentColor,
        ogImageUrl:
          data.ogImageUrl !== undefined ? data.ogImageUrl : existing[0].ogImageUrl,
        updatedAt: new Date(),
      })
      .where(eq(eventBranding.eventId, data.eventId));
  }

  return { success: true };
}

export async function duplicateEventAction(
  eventId: string,
  newName: string,
  newSlug: string,
) {
  // Was scoped only by role, while the parent was fetched by bare id — so this
  // cloned another workspace's event, wrote the copy into *their* workspace,
  // and returned their row (description, visibility, verification and audience
  // config) to the caller.
  const { user, event: parent } = await requireEventAccess(
    eventId,
    EVENT_ADMINS,
  );

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
  newStatus: "PENDING" | "ACTIVE" | "COMPLETED" | "SKIPPED",
) {
  const { user, workspace } = await requireEventAccess(eventId, EVENT_ADMINS, "manage_events");

  return await db.transaction(async (tx) => {
    // 1. Get target stage
    const stageList = await tx
      .select()
      .from(workflowStages)
      .where(
        and(
          eq(workflowStages.id, stageId),
          eq(workflowStages.eventId, eventId),
        ),
      )
      .limit(1);

    if (stageList.length === 0) {
      throw new Error("Stage not found");
    }

    const targetStage = stageList[0];

    if (newStatus === "ACTIVE" && targetStage.stageType === "VOTING") {
      const [eventRow] = await tx
        .select()
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);
      const activeCategories = await tx
        .select()
        .from(categories)
        .where(
          and(eq(categories.eventId, eventId), eq(categories.isActive, true)),
        )
        .orderBy(categories.displayOrder);
      const activeNominees = await tx
        .select({
          id: nominees.id,
          categoryId: nominees.categoryId,
          name: nominees.name,
          displayOrder: nominees.displayOrder,
        })
        .from(nominees)
        .where(
          and(eq(nominees.eventId, eventId), eq(nominees.status, "ACTIVE")),
        )
        .orderBy(nominees.displayOrder);
      if (activeCategories.length === 0)
        throw new Error(
          "Add at least one active category before opening voting.",
        );
      const invalidCategoryNames = getInvalidBallotCategoryNames(
        activeCategories,
        activeNominees,
      );
      if (invalidCategoryNames.length > 0)
        throw new Error(
          `Add eligible nominees to: ${invalidCategoryNames.join(", ")}.`,
        );
      if (
        !targetStage.startsAt ||
        !targetStage.endsAt ||
        targetStage.startsAt >= targetStage.endsAt
      )
        throw new Error(
          "Set a valid voting start and end time before activation.",
        );
      const method =
        (eventRow.verificationConfig as { method?: string } | null)?.method ??
        "NONE";
      if (!["NONE", "EMAIL_OTP", "INVITATION_CODE"].includes(method))
        throw new Error(
          "Choose a valid voter verification method before activation.",
        );
      const rosterHash = getBallotRosterHash(activeCategories, activeNominees);
      const config = targetStage.config as {
        ballotReview?: { rosterHash?: string };
      } | null;
      if (config?.ballotReview?.rosterHash !== rosterHash)
        throw new Error(
          "Review and approve the current ballot preview before opening voting.",
        );
    }

    // If activating this stage, mark previously active stage as COMPLETED
    if (newStatus === "ACTIVE") {
      await tx
        .update(workflowStages)
        .set({ status: "COMPLETED" })
        .where(
          and(
            eq(workflowStages.eventId, eventId),
            lt(workflowStages.displayOrder, targetStage.displayOrder),
            eq(workflowStages.status, "ACTIVE"),
          ),
        );
    }

    await tx
      .insert(auditLogs)
      .values({
        workspaceId: workspace.id,
        eventId,
        actorId: user.id,
        action: "workflow.stage_status_changed",
        targetType: "workflow_stage",
        targetId: stageId,
        details: { stageType: targetStage.stageType, status: newStatus },
      });

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
      if (
        targetStage.stageType === "OFFICIAL_RESULTS" ||
        targetStage.stageType === "COMMUNITY_ARCHIVE"
      ) {
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

export async function acknowledgeBallotReviewAction(eventId: string) {
  const { user, workspace } = await requireEventAccess(eventId, EVENT_ADMINS, "manage_events");
  return db.transaction(async (tx) => {
    const [votingStage] = await tx
      .select()
      .from(workflowStages)
      .where(
        and(
          eq(workflowStages.eventId, eventId),
          eq(workflowStages.stageType, "VOTING"),
        ),
      )
      .limit(1);
    if (!votingStage) throw new Error("Voting stage not found.");
    const activeCategories = await tx
      .select()
      .from(categories)
      .where(
        and(eq(categories.eventId, eventId), eq(categories.isActive, true)),
      )
      .orderBy(categories.displayOrder);
    const activeNominees = await tx
      .select({
        id: nominees.id,
        categoryId: nominees.categoryId,
        name: nominees.name,
        displayOrder: nominees.displayOrder,
      })
      .from(nominees)
      .where(and(eq(nominees.eventId, eventId), eq(nominees.status, "ACTIVE")))
      .orderBy(nominees.displayOrder);
    if (
      activeCategories.length === 0 ||
      getInvalidBallotCategoryNames(activeCategories, activeNominees).length > 0
    )
      throw new Error(
        "Resolve every ballot validation issue before approving the preview.",
      );
    const rosterHash = getBallotRosterHash(activeCategories, activeNominees);
    const config = (votingStage.config as Record<string, unknown> | null) ?? {};
    await tx
      .update(workflowStages)
      .set({
        config: {
          ...config,
          ballotReview: {
            rosterHash,
            reviewedAt: new Date().toISOString(),
            reviewedBy: user.id,
          },
        },
      })
      .where(eq(workflowStages.id, votingStage.id));
    await tx
      .insert(auditLogs)
      .values({
        workspaceId: workspace.id,
        eventId,
        actorId: user.id,
        action: "ballot.review_acknowledged",
        targetType: "workflow_stage",
        targetId: votingStage.id,
        details: { rosterHash },
      });
    return { success: true, rosterHash };
  });
}

export async function updateBallotSettingsAction(input: {
  eventId: string;
  verificationMethod?: "NONE" | "EMAIL_OTP" | "INVITATION_CODE";
  verificationLevel?: "STANDARD" | "ADVANCED";
  visibility?: "PUBLIC" | "UNLISTED" | "PRIVATE";
  liveResultsMode?:
    "FULL_LEADERBOARD" | "PERCENTAGES" | "VOTE_COUNTS" | "HIDDEN";
  audienceType?:
    "PUBLIC" | "STUDENTS" | "FACULTY" | "ALUMNI" | "INVITE_ONLY" | "MEMBERS";
}) {
  // Ballot configuration governs who may vote — workspace admins only.
  const { workspace } = await requireWorkspaceRole(WORKSPACE_ADMINS, "manage_team");

  if (input.verificationMethod) {
    const [currentEvents, submittedBallots] = await Promise.all([
      db
        .select({ verificationConfig: events.verificationConfig })
        .from(events)
        .where(
          and(
            eq(events.id, input.eventId),
            eq(events.workspaceId, workspace.id),
          ),
        )
        .limit(1),
      db
        .select({ id: voteSessions.id })
        .from(voteSessions)
        .where(
          and(
            eq(voteSessions.eventId, input.eventId),
            eq(voteSessions.status, "SUBMITTED"),
          ),
        )
        .limit(1),
    ]);
    if (!currentEvents[0]) throw new Error("Event not found.");
    const currentMethod =
      (currentEvents[0].verificationConfig as { method?: string } | null)
        ?.method ?? "NONE";
    if (
      submittedBallots.length > 0 &&
      currentMethod !== input.verificationMethod
    ) {
      throw new Error(
        "The voter verification method is locked after the first ballot is submitted.",
      );
    }
  }

  await db
    .update(events)
    .set({
      ...(input.verificationLevel && {
        verificationLevel: input.verificationLevel,
      }),
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
    .where(
      and(eq(events.id, input.eventId), eq(events.workspaceId, workspace.id)),
    );

  return { success: true };
}
