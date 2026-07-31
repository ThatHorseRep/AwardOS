"use server";

import { db } from "@/lib/db";
import {
  workspaces,
  workspaceMembers,
  workspaceInvites,
  customRoles,
  users,
} from "@/lib/db/schema";
import { eq, and, sql, isNull, desc } from "drizzle-orm";
import { getOrCreateWorkspaceAction, getCurrentUser } from "./workspaces";

// 1. Fetch workspace members list
export async function getWorkspaceMembersAction() {
  const workspace = await getOrCreateWorkspaceAction();
  if (!workspace) {
    throw new Error("No active workspace found");
  }

  const membersList = await db
    .select({
      id: workspaceMembers.id,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
      invitedAt: workspaceMembers.invitedAt,
      acceptedAt: workspaceMembers.acceptedAt,
      userName: users.displayName,
      userEmail: users.email,
      customRoleId: workspaceMembers.customRoleId,
      customRoleName: customRoles.name,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .leftJoin(customRoles, eq(workspaceMembers.customRoleId, customRoles.id))
    .where(eq(workspaceMembers.workspaceId, workspace.id))
    .orderBy(desc(workspaceMembers.invitedAt));

  return membersList;
}

// 2. Fetch invite links logs
export async function getWorkspaceInvitesAction() {
  const workspace = await getOrCreateWorkspaceAction();
  if (!workspace) {
    throw new Error("No active workspace found");
  }

  const invitesList = await db
    .select({
      id: workspaceInvites.id,
      email: workspaceInvites.email,
      role: workspaceInvites.role,
      token: workspaceInvites.token,
      maxUses: workspaceInvites.maxUses,
      usesCount: workspaceInvites.usesCount,
      expiresAt: workspaceInvites.expiresAt,
      domainRestrictions: workspaceInvites.domainRestrictions,
      createdAt: workspaceInvites.createdAt,
      customRoleId: workspaceInvites.customRoleId,
      customRoleName: customRoles.name,
    })
    .from(workspaceInvites)
    .leftJoin(customRoles, eq(workspaceInvites.customRoleId, customRoles.id))
    .where(eq(workspaceInvites.workspaceId, workspace.id))
    .orderBy(desc(workspaceInvites.createdAt));

  return invitesList;
}

// 3. Generate secure invite token
export async function generateWorkspaceInviteAction(input: {
  email?: string;
  role: "OWNER" | "ADMIN" | "EVENT_MANAGER" | "JUDGE" | "REVIEWER" | "SECRETARY" | "PRO" | "VOLUNTEER";
  customRoleId?: string;
  maxUses?: number;
  expiresDays?: number;
  domainRestrictions?: string[];
}) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const workspace = await getOrCreateWorkspaceAction();
  if (!workspace) {
    throw new Error("No active workspace");
  }

  const token = `inv_${Math.random().toString(36).substring(2)}_${Date.now()}`;
  let expiresAt: Date | null = null;
  if (input.expiresDays && input.expiresDays > 0) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + input.expiresDays);
  }

  const [newInvite] = await db
    .insert(workspaceInvites)
    .values({
      workspaceId: workspace.id,
      email: input.email || null,
      role: input.role,
      customRoleId: input.customRoleId || null,
      token,
      maxUses: input.maxUses || 1,
      usesCount: 0,
      expiresAt,
      domainRestrictions: input.domainRestrictions || [],
      createdBy: user.id,
    })
    .returning();

  return newInvite;
}

// 4. Revoke active invite link
export async function revokeWorkspaceInviteAction(inviteId: string) {
  await db
    .delete(workspaceInvites)
    .where(eq(workspaceInvites.id, inviteId));

  return { success: true };
}

// 5. Custom roles catalog getters
export async function getCustomRolesAction() {
  const workspace = await getOrCreateWorkspaceAction();
  if (!workspace) {
    throw new Error("No active workspace");
  }

  return await db
    .select()
    .from(customRoles)
    .where(eq(customRoles.workspaceId, workspace.id))
    .orderBy(customRoles.name);
}

// 6. Create custom permission role
export async function createCustomRoleAction(name: string, permissions: string[]) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const workspace = await getOrCreateWorkspaceAction();
  if (!workspace) {
    throw new Error("No active workspace");
  }

  const [role] = await db
    .insert(customRoles)
    .values({
      workspaceId: workspace.id,
      name,
      permissions,
      createdBy: user.id,
    })
    .returning();

  return role;
}

// 7. Delete custom role
export async function deleteCustomRoleAction(roleId: string) {
  await db
    .delete(customRoles)
    .where(eq(customRoles.id, roleId));

  return { success: true };
}

// 8. Remove workspace member
export async function removeWorkspaceMemberAction(memberId: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const workspace = await getOrCreateWorkspaceAction();
  if (!workspace) {
    throw new Error("No active workspace");
  }

  // Prevent deleting oneself
  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.id, memberId))
    .limit(1);

  if (member && member.userId === user.id) {
    throw new Error("You cannot remove yourself from the workspace.");
  }

  // Prevent removing owner unless other owners exist
  if (member && member.role === "OWNER") {
    const owners = await db
      .select()
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.role, "OWNER")));

    if (owners.length <= 1) {
      throw new Error("Cannot remove the last workspace OWNER.");
    }
  }

  await db
    .delete(workspaceMembers)
    .where(eq(workspaceMembers.id, memberId));

  return { success: true };
}

// 9. Update member role
export async function updateWorkspaceMemberRoleAction(
  memberId: string,
  role: "OWNER" | "ADMIN" | "EVENT_MANAGER" | "JUDGE" | "REVIEWER" | "SECRETARY" | "PRO" | "VOLUNTEER",
  customRoleId?: string | null
) {
  await db
    .update(workspaceMembers)
    .set({
      role,
      customRoleId: customRoleId || null,
      acceptedAt: new Date(),
    })
    .where(eq(workspaceMembers.id, memberId));

  return { success: true };
}
