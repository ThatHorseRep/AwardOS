/**
 * Account purge — the irreversible half of FR-AUTH-06.
 *
 * Runs after the grace window closes (see `src/lib/account-deletion.ts`). The
 * user row itself is kept but anonymized: dozens of tables carry `created_by` /
 * `actor_id` / `resolved_by` references, and the PRD asks for linked records to
 * be *anonymized* rather than shredded, so audit trails stay coherent while the
 * PII behind them is gone.
 *
 * Everything here is idempotent. A partial run (network blip mid-purge) leaves
 * `deleted_at` unset, so the next cron pass repeats the work and converges.
 */

import { db } from "@/lib/db";
import {
  users,
  workspaces,
  workspaceMembers,
  workspaceInvites,
  auditLogs,
  exportJobs,
  aiConversations,
} from "@/lib/db/schema";
import { and, asc, eq, inArray, isNull, lte, ne, sql } from "drizzle-orm";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_BYPASS_USER_ID } from "@/lib/dev-mode";
import { ANONYMIZED_DISPLAY_NAME, anonymizedEmailFor } from "@/lib/account-deletion";

export type PurgeOutcome = {
  userId: string;
  status: "PURGED" | "SKIPPED_NOT_FOUND" | "SKIPPED_ALREADY_PURGED" | "SKIPPED_NOT_DUE";
  workspacesDeleted: number;
  workspacesLeft: number;
  ownershipTransfers: number;
};

/**
 * Statuses that still count as "someone else is using this workspace". A REMOVED
 * member has already lost access, so a workspace whose only other members are
 * REMOVED is effectively the departing user's alone and goes with them.
 */
const OCCUPYING_STATUSES = ["ACTIVE", "PENDING"] as const;

/**
 * Remove the Supabase auth identity. Done *before* the database work: the auth
 * row is both the most sensitive PII (email, password hash, OAuth linkage) and
 * the only remaining way to obtain a session, so it goes first even if the rest
 * has to be retried.
 */
async function deleteAuthIdentity(userId: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error(
      "Cannot purge account: SUPABASE_SERVICE_ROLE_KEY is not configured, so the auth identity cannot be removed."
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);

  if (!error) return;

  // Already gone — a previous partial run got this far. Idempotent, not an error.
  const alreadyGone =
    (error as { status?: number }).status === 404 ||
    /not.?found/i.test(error.message || "");

  if (!alreadyGone) {
    throw new Error(`Failed to delete auth identity: ${error.message}`);
  }
}

/**
 * Pick who inherits a workspace when its last OWNER is purged. Preferring an
 * ADMIN matches FR-WS-06 (ownership transfers to an admin); the earliest-seated
 * member is the tiebreak so the choice is deterministic and re-runnable.
 *
 * This is a backstop, not the main path — `requestAccountDeletionAction` refuses
 * the request while the user is the sole owner of a shared workspace. It only
 * fires if the workspace changed shape during the 30-day window, and it exists
 * so a purge can never be blocked past its deadline or leave a workspace
 * ownerless.
 */
async function findSuccessorOwner(
  tx: typeof db,
  workspaceId: string,
  departingUserId: string
) {
  const candidates = await tx
    .select({
      id: workspaceMembers.id,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        ne(workspaceMembers.userId, departingUserId),
        eq(workspaceMembers.status, "ACTIVE")
      )
    )
    .orderBy(asc(workspaceMembers.invitedAt), asc(workspaceMembers.id));

  return candidates.find((c) => c.role === "ADMIN") ?? candidates[0] ?? null;
}

/**
 * Detach the user from every workspace they belong to.
 *
 * Sole-occupancy workspaces are deleted outright, which is what removes the
 * user's events and all voting data recorded against them — vote sessions,
 * votes, nominations, invitation codes and voter OTPs all cascade from
 * `events.workspace_id`. Shared workspaces survive; the user just leaves.
 */
async function detachFromWorkspaces(tx: typeof db, userId: string) {
  const memberships = await tx
    .select({
      id: workspaceMembers.id,
      workspaceId: workspaceMembers.workspaceId,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
    })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId));

  let workspacesDeleted = 0;
  let workspacesLeft = 0;
  let ownershipTransfers = 0;

  for (const membership of memberships) {
    // A membership the user was already removed from is history, not tenancy.
    // Letting it reach the disposition logic below would be destructive: an
    // ex-member could take a whole workspace down with them by deleting their
    // account, and a REMOVED OWNER row could trigger a bogus succession. The
    // row is still dropped, since purge anonymises the user rather than
    // deleting it, so nothing else would ever clean it up.
    if (membership.status === "REMOVED") {
      await tx.delete(workspaceMembers).where(eq(workspaceMembers.id, membership.id));
      continue;
    }

    const others = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, membership.workspaceId),
          ne(workspaceMembers.userId, userId),
          inArray(workspaceMembers.status, [...OCCUPYING_STATUSES])
        )
      );

    const otherOccupants = others[0]?.count ?? 0;

    if (otherOccupants === 0) {
      // Cascades through events → categories → nominees → nominations → votes.
      await tx.delete(workspaces).where(eq(workspaces.id, membership.workspaceId));
      workspacesDeleted += 1;
      continue;
    }

    if (membership.role === "OWNER") {
      const remainingOwners = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, membership.workspaceId),
            ne(workspaceMembers.userId, userId),
            eq(workspaceMembers.role, "OWNER"),
            eq(workspaceMembers.status, "ACTIVE")
          )
        );

      if ((remainingOwners[0]?.count ?? 0) === 0) {
        const successor = await findSuccessorOwner(tx, membership.workspaceId, userId);

        if (successor) {
          await tx
            .update(workspaceMembers)
            .set({ role: "OWNER" })
            .where(eq(workspaceMembers.id, successor.id));

          await tx.insert(auditLogs).values({
            workspaceId: membership.workspaceId,
            actorId: userId,
            action: "workspace.ownership_auto_transferred",
            targetType: "workspace_member",
            targetId: successor.id,
            details: {
              reason: "Previous owner's account was purged after a deletion request",
              previousRole: successor.role,
            },
          });

          ownershipTransfers += 1;
        }
      }
    }

    await tx.delete(workspaceMembers).where(eq(workspaceMembers.id, membership.id));
    workspacesLeft += 1;
  }

  return { workspacesDeleted, workspacesLeft, ownershipTransfers };
}

/**
 * Scrub the personal data that outlives the workspace sweep.
 *
 * These rows hang off tables the user co-owns with a surviving workspace, so no
 * cascade reaches them. Anything that is the user's own content is deleted;
 * anything that forms an audit trail is stripped of identifying detail and kept.
 */
async function scrubPersonalData(tx: typeof db, userId: string) {
  // Assistant transcripts are the user's own content — remove outright.
  // `ai_messages` cascades from `ai_conversations`.
  await tx.delete(aiConversations).where(eq(aiConversations.userId, userId));

  // Export artefacts may hold extracts of voter data under the user's name.
  await tx.delete(exportJobs).where(eq(exportJobs.requestedBy, userId));

  // Pending invites minted by this account should stop working — a live join
  // token outliving its creator is a standing grant nobody owns.
  await tx.delete(workspaceInvites).where(eq(workspaceInvites.createdBy, userId));

  // Audit entries stay (they are the record of what happened) but lose the
  // request metadata that identifies a person.
  await tx
    .update(auditLogs)
    .set({ ipAddress: null, details: { redacted: true } })
    .where(eq(auditLogs.actorId, userId));
}

/**
 * Anonymize the user row in place. Kept rather than deleted so that
 * `created_by` / `resolved_by` / `actor_id` references across the schema stay
 * valid and render as "Deleted User" instead of vanishing from history.
 */
async function anonymizeUserRow(tx: typeof db, userId: string, purgedAt: Date) {
  await tx
    .update(users)
    .set({
      email: anonymizedEmailFor(userId),
      displayName: ANONYMIZED_DISPLAY_NAME,
      passwordHash: null,
      avatarUrl: null,
      authProvider: null,
      emailVerified: false,
      updatedAt: purgedAt,
      deletedAt: purgedAt,
    })
    .where(eq(users.id, userId));
}

/**
 * Purge a single account. Safe to call repeatedly for the same id.
 *
 * `force` skips the grace-window check for an operator-initiated immediate
 * purge; the scheduled job never sets it.
 */
export async function purgeAccount(
  userId: string,
  options: { force?: boolean } = {}
): Promise<PurgeOutcome> {
  const base = {
    userId,
    workspacesDeleted: 0,
    workspacesLeft: 0,
    ownershipTransfers: 0,
  };

  if (userId === DEV_BYPASS_USER_ID) {
    throw new Error("The development bypass account cannot be purged.");
  }

  const [record] = await db
    .select({
      id: users.id,
      deletedAt: users.deletedAt,
      deletionScheduledFor: users.deletionScheduledFor,
      deletionRequestedAt: users.deletionRequestedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!record) {
    return { ...base, status: "SKIPPED_NOT_FOUND" };
  }

  if (record.deletedAt) {
    return { ...base, status: "SKIPPED_ALREADY_PURGED" };
  }

  const due =
    options.force ||
    (record.deletionScheduledFor !== null && record.deletionScheduledFor <= new Date());

  if (!due) {
    return { ...base, status: "SKIPPED_NOT_DUE" };
  }

  // Kill the credential first — see deleteAuthIdentity().
  await deleteAuthIdentity(userId);

  const purgedAt = new Date();

  const counts = await db.transaction(async (tx) => {
    const detached = await detachFromWorkspaces(tx as unknown as typeof db, userId);
    await scrubPersonalData(tx as unknown as typeof db, userId);
    await anonymizeUserRow(tx as unknown as typeof db, userId, purgedAt);
    return detached;
  });

  return { userId, status: "PURGED", ...counts };
}

/**
 * Process every account whose grace window has closed. Called by the scheduled
 * purge route. One failure does not stop the batch — the row keeps its unset
 * `deleted_at` and is retried on the next pass.
 */
export async function purgeExpiredAccounts(limit = 100) {
  const dueRows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        lte(users.deletionScheduledFor, new Date()),
        ne(users.id, DEV_BYPASS_USER_ID)
      )
    )
    .orderBy(asc(users.deletionScheduledFor))
    .limit(limit);

  const results: PurgeOutcome[] = [];
  const failures: { userId: string; error: string }[] = [];

  for (const row of dueRows) {
    try {
      results.push(await purgeAccount(row.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Account purge failed for ${row.id}:`, message);
      failures.push({ userId: row.id, error: message });
    }
  }

  return {
    due: dueRows.length,
    purged: results.filter((r) => r.status === "PURGED").length,
    skipped: results.filter((r) => r.status !== "PURGED").length,
    failed: failures.length,
    failures,
  };
}
