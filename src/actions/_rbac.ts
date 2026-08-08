import { db } from "@/lib/db";
import { workspaceMembers, events } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getCurrentUser, getOrCreateWorkspaceAction } from "./workspaces";

// NOTE: intentionally not a "use server" module — it exports constants and a
// type alongside its guards, and server-action modules may only export async
// functions. It is imported exclusively by server-side action files.

export type WorkspaceRole =
  | "OWNER"
  | "ADMIN"
  | "EVENT_MANAGER"
  | "JUDGE"
  | "REVIEWER"
  | "SECRETARY"
  | "PRO"
  | "VOLUNTEER";

/**
 * Role presets used across the action layer. Keep these coarse — one named
 * preset per capability makes it obvious at the call site which tier of
 * privilege an action demands.
 */

/** Workspace-destructive operations: members, roles, invites, custom roles. */
export const WORKSPACE_ADMINS: WorkspaceRole[] = ["OWNER", "ADMIN"];

/** Event lifecycle: create/delete/duplicate events, timeline, branding. */
export const EVENT_ADMINS: WorkspaceRole[] = ["OWNER", "ADMIN", "EVENT_MANAGER"];

/** Content moderation: AI cleanup, nomination review, integrity triage. */
export const CONTENT_MODERATORS: WorkspaceRole[] = [
  "OWNER",
  "ADMIN",
  "EVENT_MANAGER",
  "REVIEWER",
  "SECRETARY",
];

/** Results adjudication: judge scores, disqualification, publishing. */
export const RESULTS_MANAGERS: WorkspaceRole[] = [
  "OWNER",
  "ADMIN",
  "EVENT_MANAGER",
  "JUDGE",
  "SECRETARY",
];

/** Any seated member — use for dashboard reads that are not public. */
export const ALL_MEMBERS: WorkspaceRole[] = [
  "OWNER",
  "ADMIN",
  "EVENT_MANAGER",
  "JUDGE",
  "REVIEWER",
  "SECRETARY",
  "PRO",
  "VOLUNTEER",
];

/**
 * Assert that `userId` holds one of `allowedRoles` in `workspaceId`.
 * Throws on missing membership, inactive membership, or insufficient role.
 */
export async function requireRole(
  allowedRoles: WorkspaceRole[],
  workspaceId: string,
  userId: string
) {
  const member = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    )
    .limit(1);

  if (!member[0] || member[0].status !== "ACTIVE") {
    throw new Error("Unauthorized: not an active member of this workspace");
  }

  if (!allowedRoles.includes(member[0].role as WorkspaceRole)) {
    throw new Error("Unauthorized: insufficient role");
  }

  return member[0];
}

/**
 * Convenience wrapper for the common case: resolve the signed-in user and
 * their active workspace, then enforce `allowedRoles` against it.
 *
 * Returns the workspace, user, and membership row so callers can reuse them
 * instead of re-fetching (both lookups are request-cached).
 */
export async function requireWorkspaceRole(allowedRoles: WorkspaceRole[]) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  // Deletion requested but not yet purged: the session may still be valid, but
  // the account has no authority left. Checked here so every guarded action is
  // covered without each one needing to know about deletion.
  if (user.deletionRequestedAt) {
    throw new Error("Account is pending deletion. Restore it to continue.");
  }

  const workspace = await getOrCreateWorkspaceAction();
  if (!workspace) {
    throw new Error("No active workspace");
  }

  const member = await requireRole(allowedRoles, workspace.id, user.id);

  return { user, workspace, member };
}

/**
 * Assert the caller holds `allowedRoles` AND that `eventId` belongs to their
 * workspace.
 *
 * `requireWorkspaceRole` only proves the first half. Actions that take an event
 * id from the client and query on it directly will happily operate on another
 * workspace's event, since a valid session in workspace A satisfies the role
 * check while the id points at workspace B. Every action accepting a caller-
 * supplied event id must route through this.
 *
 * Soft-deleted events are excluded — a deleted event is not addressable.
 */
export async function requireEventAccess(
  eventId: string,
  allowedRoles: WorkspaceRole[]
) {
  const { user, workspace, member } = await requireWorkspaceRole(allowedRoles);

  const [event] = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.id, eventId),
        eq(events.workspaceId, workspace.id),
        isNull(events.deletedAt)
      )
    )
    .limit(1);

  if (!event) {
    // Deliberately identical to the not-found case: distinguishing "exists but
    // is not yours" from "does not exist" would confirm foreign event ids.
    throw new Error("Event not found in this workspace");
  }

  return { user, workspace, member, event };
}
