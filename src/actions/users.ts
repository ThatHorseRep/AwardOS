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

    // 2. Mirror the display name into Supabase user metadata (remote auth only).
    //
    // The avatar is deliberately NOT mirrored when it is an inline data URI.
    // user_metadata is embedded in the access token, the token is stored in a
    // cookie, and @supabase/ssr chunks that cookie across as many
    // sb-*-auth-token.N entries as it needs. The uploader produces base64 JPEGs
    // around 15 KB, which after JWT encoding pushed every signed-in request past
    // the edge's header limit — the whole domain then returned 494
    // REQUEST_HEADER_TOO_LARGE before any application code ran, and signing in
    // again immediately recreated it.
    //
    // Nothing is lost by omitting it: users.avatarUrl in the database is already
    // the source of truth for display (see getOrCreateWorkspaceAction, which
    // prefers the database record over metadata). A remote https URL is small
    // and safe to mirror, so only data URIs are held back.
    if (user.id !== "00000000-0000-0000-0000-000000000000") {
      const supabase = await createClient();
      const isInlineImage = avatarUrl?.startsWith("data:") ?? false;
      await supabase.auth.updateUser({
        data: {
          full_name: displayName,
          avatar_url: isInlineImage ? null : avatarUrl,
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
