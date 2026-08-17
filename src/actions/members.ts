"use server";

import { db } from "@/lib/db";
import { workspaces, workspaceMembers, workspaceInvites, customRoles, users, auditLogs } from "@/lib/db/schema";
import { eq, and, sql, ne, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import { getOrCreateWorkspaceAction, getCurrentUser } from "./workspaces";
import { requireWorkspaceRole, WORKSPACE_ADMINS, WORKSPACE_PERMISSIONS } from "./_rbac";

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
    // Removals are soft (status REMOVED) so the audit trail keeps its context.
    // Those rows are not members any more and must not surface in the roster.
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspace.id),
        ne(workspaceMembers.status, "REMOVED")
      )
    )
    .orderBy(desc(workspaceMembers.invitedAt));

  return membersList;
}

// 2. Fetch invite links logs
export async function getWorkspaceInvitesAction() {
  // Invite rows carry join tokens — admins only.
  const { workspace } = await requireWorkspaceRole(WORKSPACE_ADMINS, "manage_team");

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

export async function getWorkspaceAuditLogsAction() {
  const { workspace } = await requireWorkspaceRole(WORKSPACE_ADMINS, "manage_team");
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      details: auditLogs.details,
      createdAt: auditLogs.createdAt,
      actorName: users.displayName,
      actorEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .where(eq(auditLogs.workspaceId, workspace.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);
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
  const { user, workspace, member } = await requireWorkspaceRole(WORKSPACE_ADMINS, "manage_team");

  // Only an OWNER may mint an invite that confers OWNER.
  if (input.role === "OWNER" && member.role !== "OWNER") {
    throw new Error("Unauthorized: only an OWNER can grant the OWNER role");
  }

  const targetEmail = input.email ? input.email.trim().toLowerCase() : null;
  if (input.role === "OWNER" && !targetEmail) {
    throw new Error("Ownership transfer requires a specific recipient email address.");
  }
  if (input.role === "OWNER" && targetEmail === user.email.toLowerCase()) {
    throw new Error("Choose another member to receive workspace ownership.");
  }

  // Same check updateWorkspaceMemberRoleAction already performs. Without it a
  // caller could attach another workspace's custom role to this invite and pull
  // that workspace's permission set in with it.
  if (input.customRoleId) {
    const [customRole] = await db
      .select({ id: customRoles.id })
      .from(customRoles)
      .where(
        and(
          eq(customRoles.id, input.customRoleId),
          eq(customRoles.workspaceId, workspace.id)
        )
      )
      .limit(1);

    if (!customRole) {
      throw new Error("Custom role not found in this workspace");
    }
  }

  // The token is the entire credential for joining a workspace, so it comes
  // from the CSPRNG. Math.random() is a deterministic PRNG whose state can be
  // recovered from observed output, which would let an attacker derive other
  // workspaces' invite tokens.
  const token = `inv_${randomBytes(24).toString("base64url")}`;
  let expiresAt: Date | null = null;
  if (input.expiresDays && input.expiresDays > 0) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + input.expiresDays);
  }

  const isEmailTargeted = Boolean(input.email && input.email.trim().length > 0);
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

  await db.insert(auditLogs).values({
    workspaceId: workspace.id,
    actorId: user.id,
    action: input.role === "OWNER" ? "workspace.ownership_transfer_requested" : "workspace.invite_created",
    targetType: "workspace_invite",
    targetId: newInvite.id,
    details: { email: targetEmail, role: input.role, expiresAt: expiresAt?.toISOString() ?? null },
  });

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
      customRoleId: workspaceInvites.customRoleId,
      customRoleName: customRoles.name,
      createdBy: workspaceInvites.createdBy,
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

  // An invite minted for a specific address was claimable by anyone holding the
  // link — forwarding the email was enough to join a workspace you were never
  // invited to. An untargeted invite (email null) stays open by design.
  if (inv.email && inv.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error("This invitation was issued to a different email address.");
  }

  // Domain restriction check if any
  const domainRestrictions = (inv.domainRestrictions as string[]) || [];
  if (domainRestrictions.length > 0) {
    const userDomain = user.email.split("@")[1]?.toLowerCase();
    const allowed = domainRestrictions.some((d: string) => d.toLowerCase() === userDomain);
    if (!allowed) {
      throw new Error(`This invitation is restricted to domain(s): ${domainRestrictions.join(", ")}`);
    }
  }

  // Claim a use first, conditionally. The counter used to be incremented in a
  // separate unguarded statement after the member was added, so concurrent
  // redemptions of a maxUses=1 link could all pass the earlier check and every
  // one of them would join. Updating only when a use remains makes the database
  // the arbiter: exactly one concurrent caller gets a row back.
  await db.transaction(async (tx) => {
    const claimed = await tx
      .update(workspaceInvites)
      .set({ usesCount: sql`${workspaceInvites.usesCount} + 1` })
      .where(
        and(
          eq(workspaceInvites.id, inv.id),
          sql`${workspaceInvites.usesCount} < ${workspaceInvites.maxUses}`
        )
      )
      .returning({ id: workspaceInvites.id });

    if (claimed.length === 0) {
      throw new Error("This invitation has already been used.");
    }

    await tx
      .insert(workspaceMembers)
      .values({
        workspaceId: inv.workspaceId,
        userId: user.id,
        role: inv.role,
        customRoleId: inv.customRoleId || null,
        status: "ACTIVE",
        acceptedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [workspaceMembers.workspaceId, workspaceMembers.userId],
        set: {
          role: inv.role,
          customRoleId: inv.customRoleId || null,
          status: "ACTIVE",
          acceptedAt: new Date(),
        },
      });

    // OWNER invitations are explicit ownership-transfer requests. Acceptance
    // is the second party's confirmation; only then is the initiating owner
    // demoted. Both changes share this transaction so the workspace can never
    // be left between owners if either statement fails.
    if (inv.role === "OWNER" && inv.createdBy && inv.createdBy !== user.id) {
      await tx
        .update(workspaceMembers)
        .set({ role: "ADMIN", customRoleId: null })
        .where(
          and(
            eq(workspaceMembers.workspaceId, inv.workspaceId),
            eq(workspaceMembers.userId, inv.createdBy),
            eq(workspaceMembers.role, "OWNER"),
            ne(workspaceMembers.status, "REMOVED")
          )
        );
    }

    await tx.insert(auditLogs).values({
      workspaceId: inv.workspaceId,
      actorId: user.id,
      action: inv.role === "OWNER" ? "workspace.ownership_transfer_accepted" : "workspace.invite_accepted",
      targetType: "workspace_invite",
      targetId: inv.id,
      details: { role: inv.role, previousOwnerId: inv.role === "OWNER" ? inv.createdBy : null },
    });
  });

  return { success: true, workspaceName: inv.workspaceName };
}

// 6. Revoke active invite link
export async function revokeWorkspaceInviteAction(inviteId: string) {
  const { user, workspace } = await requireWorkspaceRole(WORKSPACE_ADMINS, "manage_team");

  // Scope the delete to the caller's workspace — the role check alone would let
  // an admin in one workspace revoke another workspace's invites by id.
  await db
    .delete(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.id, inviteId),
        eq(workspaceInvites.workspaceId, workspace.id)
      )
    );

  await db.insert(auditLogs).values({ workspaceId: workspace.id, actorId: user.id, action: "workspace.invite_revoked", targetType: "workspace_invite", targetId: inviteId });

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
  const { user, workspace } = await requireWorkspaceRole(WORKSPACE_ADMINS, "manage_team");

  const cleanName = name.trim().slice(0, 80);
  if (!cleanName) throw new Error("Enter a custom role name.");
  const allowedPermissions = new Set<string>(WORKSPACE_PERMISSIONS);
  const cleanPermissions = [...new Set(permissions)].filter((permission) =>
    allowedPermissions.has(permission)
  );
  if (cleanPermissions.length === 0) {
    throw new Error("Select at least one valid permission.");
  }

  const [role] = await db
    .insert(customRoles)
    .values({
      workspaceId: workspace.id,
      name: cleanName,
      permissions: cleanPermissions,
      createdBy: user.id,
    })
    .returning();

  await db.insert(auditLogs).values({ workspaceId: workspace.id, actorId: user.id, action: "workspace.custom_role_created", targetType: "custom_role", targetId: role.id, details: { name: cleanName, permissions: cleanPermissions } });

  return role;
}

// 9. Delete custom role
export async function deleteCustomRoleAction(roleId: string) {
  const { workspace } = await requireWorkspaceRole(WORKSPACE_ADMINS, "manage_team");

  await db
    .delete(customRoles)
    .where(and(eq(customRoles.id, roleId), eq(customRoles.workspaceId, workspace.id)));

  return { success: true };
}

// 10. Remove workspace member
export async function removeWorkspaceMemberAction(memberId: string) {
  const { user, workspace } = await requireWorkspaceRole(WORKSPACE_ADMINS, "manage_team");

  // Prevent deleting oneself
  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.id, memberId),
        // Scope the lookup, not just the checks below — resolving the row
        // unscoped let an admin remove members of another workspace.
        eq(workspaceMembers.workspaceId, workspace.id),
        // An already-removed row is not a member, so removing it again is a
        // no-op that should read as "not found" rather than succeed silently.
        ne(workspaceMembers.status, "REMOVED")
      )
    )
    .limit(1);

  if (!member) {
    throw new Error("Member not found in this workspace");
  }

  if (member.userId === user.id) {
    throw new Error("You cannot remove yourself from the workspace.");
  }

  // Prevent removing owner unless other owners exist
  if (member.role === "OWNER") {
    const owners = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspace.id),
          eq(workspaceMembers.role, "OWNER"),
          // Removed owners still hold their OWNER role on the row. Counting
          // them would let this guard pass on a workspace whose only real
          // owner is the one being removed, orphaning it.
          ne(workspaceMembers.status, "REMOVED")
        )
      );

    if (owners.length <= 1) {
      throw new Error("Cannot remove the last workspace OWNER.");
    }
  }

  // Soft delete. A hard DELETE dropped the invitedBy/invitedAt trail and any
  // audit context pointing at the row; flipping status revokes access just as
  // completely, because `requireRole` admits ACTIVE members only.
  await db
    .update(workspaceMembers)
    .set({ status: "REMOVED" })
    .where(
      and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspaceId, workspace.id))
    );

  await db.insert(auditLogs).values({ workspaceId: workspace.id, actorId: user.id, action: "workspace.member_removed", targetType: "workspace_member", targetId: member.id, details: { removedUserId: member.userId, previousRole: member.role } });

  return { success: true };
}

// 11. Update member role
export async function updateWorkspaceMemberRoleAction(
  memberId: string,
  role: "OWNER" | "ADMIN" | "EVENT_MANAGER" | "JUDGE" | "REVIEWER" | "SECRETARY" | "PRO" | "VOLUNTEER",
  customRoleId?: string | null
) {
  const { user, workspace, member: actor } = await requireWorkspaceRole(WORKSPACE_ADMINS, "manage_team");

  // Ownership changes require the current owner to create a targeted OWNER
  // invitation and the recipient to accept it. A direct role edit would skip
  // the recipient's confirmation and is therefore never allowed here.
  if (role === "OWNER") {
    throw new Error("Transfer ownership with a targeted owner invitation.");
  }

  // The guard above is one-directional: it blocked *granting* OWNER but not
  // *removing* it, so an ADMIN could demote the sole OWNER to VOLUNTEER and
  // take the workspace over. removeWorkspaceMemberAction protects the last
  // OWNER already — the same invariant has to hold on this path.
  const [target] = await db
    .select({ id: workspaceMembers.id, role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.id, memberId),
        eq(workspaceMembers.workspaceId, workspace.id),
        ne(workspaceMembers.status, "REMOVED")
      )
    )
    .limit(1);

  if (!target) {
    throw new Error("Member not found in this workspace");
  }

  if (target.role === "OWNER") {
    if (actor.role !== "OWNER") {
      throw new Error("Unauthorized: only an OWNER can change another OWNER's role");
    }

    const owners = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspace.id),
          eq(workspaceMembers.role, "OWNER"),
          ne(workspaceMembers.status, "REMOVED")
        )
      );

    if (owners.length <= 1) {
      throw new Error("Cannot demote the last workspace OWNER.");
    }
  }

  // A custom role from another workspace would leak its permission set into
  // this one, so pin it to the caller's workspace before attaching it.
  if (customRoleId) {
    const [customRole] = await db
      .select({ id: customRoles.id })
      .from(customRoles)
      .where(
        and(eq(customRoles.id, customRoleId), eq(customRoles.workspaceId, workspace.id))
      )
      .limit(1);

    if (!customRole) {
      throw new Error("Custom role not found in this workspace");
    }
  }

  const updated = await db
    .update(workspaceMembers)
    .set({
      role,
      customRoleId: customRoleId || null,
      acceptedAt: new Date(),
    })
    // Without the workspace predicate an admin here could rewrite roles — up to
    // and including OWNER — for members of any other workspace.
    .where(
      and(
        eq(workspaceMembers.id, memberId),
        eq(workspaceMembers.workspaceId, workspace.id),
        // Removed rows are kept for history, not for editing.
        ne(workspaceMembers.status, "REMOVED")
      )
    )
    .returning({ id: workspaceMembers.id });

  if (updated.length === 0) {
    throw new Error("Member not found in this workspace");
  }

  await db.insert(auditLogs).values({ workspaceId: workspace.id, actorId: user.id, action: "workspace.member_role_updated", targetType: "workspace_member", targetId: memberId, details: { previousRole: target.role, role, customRoleId: customRoleId || null } });

  return { success: true };
}
