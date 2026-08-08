import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DEV_BYPASS_USER_ID } from "@/lib/dev-mode";

/**
 * Mirror a Supabase auth user into the local `users` table.
 *
 * Deliberately a plain module rather than a `"use server"` export. Every export
 * of a server-action module is a callable POST endpoint, and this function
 * takes a user id and email as arguments — as an action it let an unauthenticated
 * caller seed arbitrary rows. Callers are all server-side and already
 * authenticated, so the id they pass is one Supabase already vouched for.
 */
export async function ensureUserRecord(
  userId: string,
  email: string,
  displayName: string
) {
  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (existing.length === 0) {
      await db
        .insert(users)
        .values({
          id: userId,
          email,
          displayName,
          authProvider: userId === DEV_BYPASS_USER_ID ? "EMAIL" : "GOOGLE",
          emailVerified: true,
        })
        .onConflictDoNothing();
    }
  } catch (err) {
    console.warn("Failed to ensure user record in DB:", err);
  }
}
