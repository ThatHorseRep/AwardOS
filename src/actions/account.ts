"use server";

import { db } from "@/lib/db";
import {
  users,
  workspaces,
  workspaceMembers,
  events,
  votes,
  nominations,
  auditLogs,
} from "@/lib/db/schema";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "./workspaces";
import { DEV_BYPASS_USER_ID } from "@/lib/dev-mode";
import {
  ACCOUNT_DELETION_CONFIRM_PHRASE,
  ACCOUNT_DELETION_GRACE_DAYS,
  deletionScheduledDateFrom,
} from "@/lib/account-deletion";

type WorkspaceImpact = {
  workspaceId: string;
  workspaceName: string;
  role: string;
  otherMembers: number;
  /** DELETE = goes with the account. LEAVE = survives, user is removed from it. */
  disposition: "DELETE" | "LEAVE";
  eventCount: number;
  voteCount: number;
  nominationCount: number;
};

type DeletionBlocker = {
  code: "SOLE_OWNER_OF_SHARED_WORKSPACE" | "DEV_ACCOUNT";
  message: string;
};

/**
 * Discriminated so the confirmation UI can read `scheduledFor` after checking
 * `success` — inferred return types widen `success` to `boolean` and lose that.
 */
type DeletionRequestResult =
  | { success: true; message: string; scheduledFor: string; graceDays: number }
  | {
      success: false;
      message: string;
      alreadyPending?: boolean;
      blockers?: DeletionBlocker[];
    };

const OCCUPYING_STATUSES = ["ACTIVE", "PENDING"] as const;

async function requireSignedInUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

async function readDeletionState(userId: string) {
  const [row] = await db
    .select({
      deletionRequestedAt: users.deletionRequestedAt,
      deletionScheduledFor: users.deletionScheduledFor,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return row ?? null;
}

/**
 * Whether this account can authenticate with a password. Google-only accounts
 * have nothing to re-enter, so their confirmation gate is the typed-email check
 * alone. Read from Supabase identities rather than `users.auth_provider`, which
 * is a best-effort mirror written by the profile action.
 */
async function hasPasswordIdentity(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return Boolean(user?.identities?.some((identity) => identity.provider === "email"));
  } catch {
    return false;
  }
}

/**
 * Verify a password without touching the session cookies. Uses a bare client so
 * a successful check does not rotate the caller's tokens mid-request.
 */
async function verifyPassword(email: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;

  const probe = createSupabaseClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await probe.auth.signInWithPassword({ email, password });
  return !error;
}

async function getClientIp(): Promise<string | null> {
  try {
    const headerList = await headers();
    const forwarded = headerList.get("x-forwarded-for");
    return forwarded ? forwarded.split(",")[0].trim() : headerList.get("x-real-ip");
  } catch {
    return null;
  }
}

/**
 * Everything the confirmation screen needs: what the user is about to lose, and
 * whether they are allowed to proceed at all.
 *
 * Read-only and safe to call on page load.
 */
export async function getAccountDeletionPreflightAction() {
  const user = await requireSignedInUser();
  const state = await readDeletionState(user.id);

  const memberships = await db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      role: workspaceMembers.role,
      workspaceName: workspaces.name,
      workspaceType: workspaces.type,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    // Workspaces the user was removed from are not theirs to lose. Counting one
    // here would show a phantom impact — and worse, a REMOVED OWNER row would
    // raise a sole-owner blocker they can never clear, since they have no
    // access to that workspace to transfer ownership.
    .where(
      and(
        eq(workspaceMembers.userId, user.id),
        ne(workspaceMembers.status, "REMOVED")
      )
    );

  const impacts: WorkspaceImpact[] = [];
  const blockers: DeletionBlocker[] = [];

  for (const membership of memberships) {
    const [others] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, membership.workspaceId),
          ne(workspaceMembers.userId, user.id),
          inArray(workspaceMembers.status, [...OCCUPYING_STATUSES])
        )
      );

    const otherMembers = others?.count ?? 0;
    const disposition: "DELETE" | "LEAVE" = otherMembers === 0 ? "DELETE" : "LEAVE";

    // PRD EDGE-WS-01: an owner may not walk away from a workspace other people
    // are still using without handing it over first.
    if (disposition === "LEAVE" && membership.role === "OWNER") {
      const [otherOwners] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, membership.workspaceId),
            ne(workspaceMembers.userId, user.id),
            eq(workspaceMembers.role, "OWNER"),
            eq(workspaceMembers.status, "ACTIVE")
          )
        );

      if ((otherOwners?.count ?? 0) === 0) {
        blockers.push({
          code: "SOLE_OWNER_OF_SHARED_WORKSPACE",
          message: `You must transfer ownership of ${membership.workspaceName} before deleting your account.`,
        });
      }
    }

    const eventRows = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.workspaceId, membership.workspaceId));

    const eventIds = eventRows.map((e) => e.id);
    let voteCount = 0;
    let nominationCount = 0;

    // Only meaningful for workspaces that die with the account — a workspace the
    // user merely leaves keeps all of its data.
    if (disposition === "DELETE" && eventIds.length > 0) {
      const [voteAgg] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(votes)
        .where(inArray(votes.eventId, eventIds));
      const [nominationAgg] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(nominations)
        .where(inArray(nominations.eventId, eventIds));

      voteCount = voteAgg?.count ?? 0;
      nominationCount = nominationAgg?.count ?? 0;
    }

    impacts.push({
      workspaceId: membership.workspaceId,
      workspaceName: membership.workspaceName,
      role: membership.role,
      otherMembers,
      disposition,
      eventCount: eventIds.length,
      voteCount,
      nominationCount,
    });
  }

  if (user.id === DEV_BYPASS_USER_ID) {
    blockers.push({
      code: "DEV_ACCOUNT",
      message: "The development bypass account cannot be deleted.",
    });
  }

  return {
    email: user.email,
    displayName: user.displayName,
    requiresPassword: await hasPasswordIdentity(),
    confirmPhrase: ACCOUNT_DELETION_CONFIRM_PHRASE,
    graceDays: ACCOUNT_DELETION_GRACE_DAYS,
    pendingDeletion: Boolean(state?.deletionRequestedAt && !state?.deletedAt),
    deletionRequestedAt: state?.deletionRequestedAt?.toISOString() ?? null,
    deletionScheduledFor: state?.deletionScheduledFor?.toISOString() ?? null,
    workspaces: impacts,
    blockers,
    canDelete: blockers.length === 0,
  };
}

/**
 * Open a deletion request (FR-AUTH-06).
 *
 * Immediate effect: the account is locked out and every session is revoked.
 * Deferred effect: PII is erased once the grace window closes, either by the
 * scheduled purge job or by an operator running it early.
 *
 * The confirmation gate is deliberately awkward — typed email, typed phrase, and
 * a password re-entry where one exists — because this is the one action in the
 * product that destroys data belonging to other people (voters, nominees) as a
 * side effect.
 */
export async function requestAccountDeletionAction(input: {
  confirmEmail: string;
  confirmPhrase: string;
  password?: string;
  reason?: string;
}): Promise<DeletionRequestResult> {
  const user = await requireSignedInUser();

  if (user.id === DEV_BYPASS_USER_ID) {
    return { success: false, message: "The development bypass account cannot be deleted." };
  }

  const state = await readDeletionState(user.id);
  if (state?.deletedAt) {
    return { success: false, message: "This account has already been deleted." };
  }
  if (state?.deletionRequestedAt) {
    return {
      success: false,
      message: "This account is already scheduled for deletion.",
      alreadyPending: true,
    };
  }

  // 1. Confirmation gate.
  if (input.confirmEmail?.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
    return { success: false, message: "The email address you typed does not match this account." };
  }

  if (input.confirmPhrase?.trim() !== ACCOUNT_DELETION_CONFIRM_PHRASE) {
    return {
      success: false,
      message: `Type ${ACCOUNT_DELETION_CONFIRM_PHRASE} exactly to confirm.`,
    };
  }

  // 2. Re-authenticate password accounts. Google-only accounts have no password
  //    to check; the typed-email gate above stands in for it.
  if (await hasPasswordIdentity()) {
    if (!input.password) {
      return { success: false, message: "Enter your password to confirm deletion." };
    }
    if (!(await verifyPassword(user.email, input.password))) {
      return { success: false, message: "Incorrect password." };
    }
  }

  // 3. Re-run the ownership guard server-side — the preflight is advisory, this
  //    is the one that counts.
  const preflight = await getAccountDeletionPreflightAction();
  if (!preflight.canDelete) {
    return {
      success: false,
      message: preflight.blockers[0]?.message || "This account cannot be deleted yet.",
      blockers: preflight.blockers,
    };
  }

  const requestedAt = new Date();
  const scheduledFor = deletionScheduledDateFrom(requestedAt);

  await db
    .update(users)
    .set({
      deletionRequestedAt: requestedAt,
      deletionScheduledFor: scheduledFor,
      updatedAt: requestedAt,
    })
    .where(and(eq(users.id, user.id), isNull(users.deletedAt)));

  // 4. Record the request in every workspace the account touches, before the
  //    memberships disappear at purge time.
  const ipAddress = await getClientIp();
  const memberships = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    // Only workspaces the user still belongs to. A removed membership would
    // broadcast their account activity into a team they are no longer part of.
    .where(
      and(
        eq(workspaceMembers.userId, user.id),
        ne(workspaceMembers.status, "REMOVED")
      )
    );

  if (memberships.length > 0) {
    await db.insert(auditLogs).values(
      memberships.map((m) => ({
        workspaceId: m.workspaceId,
        actorId: user.id,
        action: "account.deletion_requested",
        targetType: "user",
        targetId: user.id,
        details: {
          scheduledFor: scheduledFor.toISOString(),
          graceDays: ACCOUNT_DELETION_GRACE_DAYS,
          reason: input.reason?.slice(0, 500) || null,
        },
        ipAddress,
      }))
    );
  }

  // 5. Revoke every issued session, not just this browser's — a deletion request
  //    should invalidate any token an attacker already holds.
  try {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "global" });
  } catch (err) {
    console.warn("Global sign-out during deletion request failed:", err);
  }

  revalidatePath("/settings/account");
  revalidatePath("/dashboard");

  return {
    success: true,
    message: `Your account is scheduled for deletion on ${scheduledFor.toUTCString()}.`,
    scheduledFor: scheduledFor.toISOString(),
    graceDays: ACCOUNT_DELETION_GRACE_DAYS,
  };
}

/**
 * Withdraw a pending request during the grace window. Restores access; nothing
 * needs undoing because nothing has been erased yet.
 */
export async function cancelAccountDeletionAction() {
  const user = await requireSignedInUser();
  const state = await readDeletionState(user.id);

  if (!state || !state.deletionRequestedAt) {
    return { success: false, message: "This account is not scheduled for deletion." };
  }

  if (state.deletedAt) {
    return {
      success: false,
      message: "This account has already been deleted and cannot be restored.",
    };
  }

  await db
    .update(users)
    .set({
      deletionRequestedAt: null,
      deletionScheduledFor: null,
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, user.id), isNull(users.deletedAt)));

  const ipAddress = await getClientIp();
  const memberships = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    // Only workspaces the user still belongs to. A removed membership would
    // broadcast their account activity into a team they are no longer part of.
    .where(
      and(
        eq(workspaceMembers.userId, user.id),
        ne(workspaceMembers.status, "REMOVED")
      )
    );

  if (memberships.length > 0) {
    await db.insert(auditLogs).values(
      memberships.map((m) => ({
        workspaceId: m.workspaceId,
        actorId: user.id,
        action: "account.deletion_cancelled",
        targetType: "user",
        targetId: user.id,
        details: {
          originallyScheduledFor: state.deletionScheduledFor?.toISOString() ?? null,
        },
        ipAddress,
      }))
    );
  }

  revalidatePath("/settings/account");
  revalidatePath("/dashboard");

  return { success: true, message: "Your account has been restored." };
}

/**
 * Deletion state for the signed-in user. Used by the recovery screen, which the
 * dashboard redirects to while a request is pending.
 */
export async function getAccountDeletionStatusAction() {
  const user = await getCurrentUser();
  if (!user) return null;

  const state = await readDeletionState(user.id);
  if (!state?.deletionRequestedAt || state.deletedAt) return null;

  return {
    email: user.email,
    displayName: user.displayName,
    requestedAt: state.deletionRequestedAt.toISOString(),
    scheduledFor: state.deletionScheduledFor?.toISOString() ?? null,
    graceDays: ACCOUNT_DELETION_GRACE_DAYS,
  };
}
