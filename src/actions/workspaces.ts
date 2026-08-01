"use server";

import { db } from "@/lib/db";
import { workspaces, workspaceMembers, users } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { eq, and } from "drizzle-orm";
import { cookies } from "next/headers";

export async function getCurrentUser() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      return {
        id: user.id,
        email: user.email || "",
        displayName: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "User",
      };
    }
  } catch (err) {
    console.warn("Supabase auth user check warning:", err);
  }

  // Check dev mode bypass
  try {
    const cookieStore = await cookies();
    const isDevBypass = cookieStore.get("awardos_dev_mode")?.value === "true";
    
    if (isDevBypass) {
      return {
        id: "00000000-0000-0000-0000-000000000000",
        email: "dev@awardos.local",
        displayName: "Development User",
      };
    }
  } catch (err) {
    // Ignore cookie read error
  }

  return null;
}

export async function ensureUserRecord(userId: string, email: string, displayName: string) {
  try {
    const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (existing.length === 0) {
      await db
        .insert(users)
        .values({
          id: userId,
          email: email,
          displayName: displayName,
          authProvider: userId === "00000000-0000-0000-0000-000000000000" ? "EMAIL" : "GOOGLE",
          emailVerified: true,
        })
        .onConflictDoNothing();
    }
  } catch (err) {
    console.warn("Failed to ensure user record in DB:", err);
  }
}

export async function getOrCreateWorkspaceAction() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return null;
    }

    // Ensure local user record exists
    await ensureUserRecord(user.id, user.email, user.displayName);

    // Check if user is a member of any workspace
    const memberRecord = await db
      .select()
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.userId, user.id), eq(workspaceMembers.status, "ACTIVE")))
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
        .onConflictDoNothing();
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
}
