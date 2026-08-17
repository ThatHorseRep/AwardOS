"use server";

import { db } from "@/lib/db";
import { workspaces, workspaceMembers, users } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { eq, and, asc } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { DEV_BYPASS_COOKIE, DEV_BYPASS_USER_ID, isDevBypassActive } from "@/lib/dev-mode";
import { ensureUserRecord } from "@/lib/ensure-user";

export const getCurrentUser = cache(async function _getCurrentUser() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      let avatarUrl = user.user_metadata?.avatar_url || null;
      let displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "User";

      let deletionRequestedAt: Date | null = null;

      try {
        const records = await db
          .select({
            avatarUrl: users.avatarUrl,
            displayName: users.displayName,
            deletionRequestedAt: users.deletionRequestedAt,
            deletedAt: users.deletedAt,
          })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);
        if (records.length > 0) {
          if (records[0].avatarUrl) avatarUrl = records[0].avatarUrl;
          if (records[0].displayName) displayName = records[0].displayName;
          // A purged account keeps an anonymized row; nobody may sign back into it.
          if (records[0].deletedAt) return null;
          deletionRequestedAt = records[0].deletionRequestedAt;
        }
      } catch {
        // Fallback to metadata
      }

      return {
        id: user.id,
        email: user.email || "",
        displayName,
        avatarUrl,
        deletionRequestedAt,
      };
    }
  } catch (err) {
    console.warn("Supabase auth user check warning:", err);
  }

  // Check dev mode bypass (development builds only)
  try {
    const cookieStore = await cookies();
    const isDevBypass = isDevBypassActive(cookieStore.get(DEV_BYPASS_COOKIE)?.value);

    if (isDevBypass) {
      return {
        id: DEV_BYPASS_USER_ID,
        email: "dev@awardos.local",
        displayName: "Development User",
        avatarUrl: null,
        deletionRequestedAt: null,
      };
    }
  } catch {
    // Ignore cookie read error
  }

  return null;
});

export const getOrCreateWorkspaceAction = cache(async function _getOrCreateWorkspaceAction() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return null;
    }

    // An account inside its deletion grace window keeps no working workspace —
    // and must never have a fresh personal one auto-created underneath it.
    if (user.deletionRequestedAt) {
      return null;
    }

    // Ensure local user record exists
    await ensureUserRecord(user.id, user.email, user.displayName);

    const cookieStore = await cookies();
    const selectedWorkspaceId = cookieStore.get("awardos_workspace_id")?.value;
    // Honor an explicit workspace selection only after proving active membership.
    if (selectedWorkspaceId) {
      const [selected] = await db.select({ workspace: workspaces }).from(workspaceMembers).innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id)).where(and(eq(workspaceMembers.userId, user.id), eq(workspaceMembers.workspaceId, selectedWorkspaceId), eq(workspaceMembers.status, "ACTIVE"))).limit(1);
      if (selected) return selected.workspace;
    }

    // Check if the user is a member of any workspace, deterministically.
    const memberRecord = await db
      .select()
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.userId, user.id), eq(workspaceMembers.status, "ACTIVE")))
      .orderBy(asc(workspaceMembers.invitedAt), asc(workspaceMembers.workspaceId))
      .limit(1);

    if (memberRecord.length > 0) {
      const workspaceId = memberRecord[0].workspaceId;
      const ws = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
      if (ws.length > 0) {
        return ws[0];
      }
    }

    // Check if a personal workspace already exists by slug
    const workspaceSlug = `personal-${user.id.substring(0, 8)}`;
    const existingWs = await db.select().from(workspaces).where(eq(workspaces.slug, workspaceSlug)).limit(1);

    if (existingWs.length > 0) {
      await db
        .insert(workspaceMembers)
        .values({
          workspaceId: existingWs[0].id,
          userId: user.id,
          role: "OWNER",
          status: "ACTIVE",
        })
        // The slug is derived from this user's own id, so the workspace is
        // theirs by construction and re-seating them as OWNER is correct.
        // `onConflictDoNothing` would leave a REMOVED row in place and hand
        // back a workspace `requireRole` then refuses — locking the user out
        // of their own workspace on every request, with no way to recover.
        .onConflictDoUpdate({
          target: [workspaceMembers.workspaceId, workspaceMembers.userId],
          set: {
            role: "OWNER",
            status: "ACTIVE",
            acceptedAt: new Date(),
          },
        });
      return existingWs[0];
    }

    // Create a default personal workspace if none exists
    const [ws] = await db
      .insert(workspaces)
      .values({
        name: `${user.displayName}'s Workspace`,
        slug: workspaceSlug,
        type: "PERSONAL",
        createdBy: user.id,
      })
      .returning();

    await db
      .insert(workspaceMembers)
      .values({
        workspaceId: ws.id,
        userId: user.id,
        role: "OWNER",
        status: "ACTIVE",
      })
      .onConflictDoNothing();

    return ws;
  } catch (err) {
    console.error("getOrCreateWorkspaceAction error handled:", err);
    return null;
  }
});

export async function listUserWorkspacesAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return db.select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug, type: workspaces.type }).from(workspaceMembers).innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id)).where(and(eq(workspaceMembers.userId, user.id), eq(workspaceMembers.status, "ACTIVE"))).orderBy(asc(workspaces.name));
}

export async function switchWorkspaceAction(workspaceId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  const [membership] = await db.select({ id: workspaceMembers.id }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id), eq(workspaceMembers.status, "ACTIVE"))).limit(1);
  if (!membership) throw new Error("Workspace not found.");
  const cookieStore = await cookies();
  cookieStore.set("awardos_workspace_id", workspaceId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return { success: true };
}
