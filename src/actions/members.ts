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

// 3. Generate secure invite token / direct email invitation
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

  const isEmailTargeted = Boolean(input.email && input.email.trim().length > 0);
  const targetEmail = input.email ? input.email.trim().toLowerCase() : null;
  const maxUses = isEmailTargeted ? 1 : (input.maxUses || 1);

  let directMemberAdded = false;

  // If email is provided, check if user exists in the system and add them directly
  if (targetEmail) {
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, targetEmail))
      .limit(1);

    if (existingUser.length > 0) {
      const targetUserId = existingUser[0].id;
      await db
        .insert(workspaceMembers)
        .values({
          workspaceId: workspace.id,
          userId: targetUserId,
          role: input.role,
          customRoleId: input.customRoleId || null,
          status: "PENDING",
          invitedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [workspaceMembers.workspaceId, workspaceMembers.userId],
          set: {
            role: input.role,
            customRoleId: input.customRoleId || null,
            status: "PENDING",
            invitedAt: new Date(),
          },
        });
      directMemberAdded = true;
    }
  }

  const [newInvite] = await db
    .insert(workspaceInvites)
    .values({
      workspaceId: workspace.id,
      email: targetEmail,
      role: input.role,
      customRoleId: input.customRoleId || null,
      token,
      maxUses,
      usesCount: 0,
      expiresAt,
      domainRestrictions: input.domainRestrictions || [],
      createdBy: user.id,
    })
    .returning();

  return {
    ...newInvite,
    directMemberAdded,
    targetEmail,
  };
}

// 4. Get Invitation Link Details for Acceptance Page
export async function getInviteDetailsAction(token: string) {
  const invites = await db
    .select({
      id: workspaceInvites.id,
      token: workspaceInvites.token,
      email: workspaceInvites.email,
      role: workspaceInvites.role,
      maxUses: workspaceInvites.maxUses,
      usesCount: workspaceInvites.usesCount,
      expiresAt: workspaceInvites.expiresAt,
      domainRestrictions: workspaceInvites.domainRestrictions,
      workspaceId: workspaceInvites.workspaceId,
      workspaceName: workspaces.name,
      customRoleName: customRoles.name,
    })
    .from(workspaceInvites)
    .innerJoin(workspaces, eq(workspaceInvites.workspaceId, workspaces.id))
    .leftJoin(customRoles, eq(workspaceInvites.customRoleId, customRoles.id))
    .where(eq(workspaceInvites.token, token))
    .limit(1);

  if (invites.length === 0) {
    return { valid: false, reason: "Invitation link not found" };
  }

  const inv = invites[0];

  // Check expiration
  if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) {
    return { valid: false, reason: "Invitation link has expired" };
  }

  // Check max usages
  if (inv.maxUses !== 9999 && inv.usesCount >= inv.maxUses) {
    return { valid: false, reason: "Invitation link has reached its maximum usage limit" };
  }

  return {
    valid: true,
    invite: inv,
  };
}

// 5. Accept Workspace Invitation Action
export async function acceptWorkspaceInviteAction(token: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("You must be signed in to accept this invitation.");
  }

  const inviteRes = await getInviteDetailsAction(token);
  if (!inviteRes.valid || !inviteRes.invite) {
    throw new Error(inviteRes.reason || "Invalid invitation link.");
  }

  const inv = inviteRes.invite;

  // Domain restriction check if any
  const domainRestrictions = (inv.domainRestrictions as string[]) || [];
  if (domainRestrictions.length > 0) {
    const userDomain = user.email.split("@")[1]?.toLowerCase();
    const allowed = domainRestrictions.some((d: string) => d.toLowerCase() === userDomain);
    if (!allowed) {
      throw new Error(`This invitation is restricted to domain(s): ${domainRestrictions.join(", ")}`);
    }
  }

  // Add user as workspace member
  await db
    .insert(workspaceMembers)
    .values({
      workspaceId: inv.workspaceId,
      userId: user.id,
      role: inv.role,
      status: "ACTIVE",
      acceptedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [workspaceMembers.workspaceId, workspaceMembers.userId],
      set: {
        role: inv.role,
        status: "ACTIVE",
        acceptedAt: new Date(),
      },
    });

  // Increment uses count
  await db
    .update(workspaceInvites)
    .set({
      usesCount: sql`${workspaceInvites.usesCount} + 1`,
    })
    .where(eq(workspaceInvites.id, inv.id));

  return { success: true, workspaceName: inv.workspaceName };
}

// 6. Revoke active invite link
export async function revokeWorkspaceInviteAction(inviteId: string) {
  await db
    .delete(workspaceInvites)
    .where(eq(workspaceInvites.id, inviteId));

  return { success: true };
}

// 7. Custom roles catalog getters
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

// 8. Create custom permission role
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

// 9. Delete custom role
export async function deleteCustomRoleAction(roleId: string) {
  await db
    .delete(customRoles)
    .where(eq(customRoles.id, roleId));

  return { success: true };
}

// 10. Remove workspace member
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

// 11. Update member role
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
