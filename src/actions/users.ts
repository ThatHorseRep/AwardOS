"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "./workspaces";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export async function getUserProfileAction() {
  const user = await getCurrentUser();
  if (!user) return null;

  try {
    const records = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (records.length > 0) {
      const rec = records[0];
      return {
        id: rec.id,
        email: rec.email,
        displayName: rec.displayName || user.displayName,
        avatarUrl: rec.avatarUrl || null,
        authProvider: rec.authProvider || (user.id === "00000000-0000-0000-0000-000000000000" ? "DEV" : "GOOGLE"),
        emailVerified: rec.emailVerified ?? true,
        createdAt: rec.createdAt ? new Date(rec.createdAt).toISOString() : new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn("Failed to fetch user profile from DB, using fallback:", err);
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: null,
    authProvider: user.id === "00000000-0000-0000-0000-000000000000" ? "DEV" : "GOOGLE",
    emailVerified: true,
    createdAt: new Date().toISOString(),
  };
}

export async function updateUserProfileFormAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const displayName = (formData.get("displayName") as string)?.trim() || user.displayName;
  const avatarUrl = (formData.get("avatarUrl") as string)?.trim() || null;

  try {
    // 1. Update database record
    await db
      .insert(users)
      .values({
        id: user.id,
        email: user.email,
        displayName: displayName,
        avatarUrl: avatarUrl,
        authProvider: user.id === "00000000-0000-0000-0000-000000000000" ? "EMAIL" : "GOOGLE",
        emailVerified: true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          displayName: displayName,
          avatarUrl: avatarUrl,
          updatedAt: new Date(),
        },
      });

    // 2. Update Supabase User Metadata (if remote auth)
    if (user.id !== "00000000-0000-0000-0000-000000000000") {
      const supabase = await createClient();
      await supabase.auth.updateUser({
        data: {
          full_name: displayName,
          avatar_url: avatarUrl,
        },
      });
    }

    revalidatePath("/settings/profile");
    revalidatePath("/dashboard");
    return { success: true, message: "Profile updated successfully!" };
  } catch (err: any) {
    console.error("Failed to update user profile:", err);
    return { success: false, message: err?.message || "Failed to update profile." };
  }
}
