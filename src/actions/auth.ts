"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DEV_BYPASS_COOKIE } from "@/lib/dev-mode";
import { safeInternalPath } from "@/lib/navigation-intent";
import { z } from "zod";

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(1024),
  redirect: z.string().max(2048).optional(),
});

/**
 * Not exported: every export of a `"use server"` module is a callable POST
 * endpoint, and this one takes the redirect target as an argument. Exported, it
 * was an open redirect that anyone could invoke.
 */
const encodedRedirect = async (
  type: "error" | "success",
  path: string,
  message: string,
) => {
  return redirect(`${path}${path.includes("?") ? "&" : "?"}${type}=${encodeURIComponent(message)}`);
};

function errorDetails(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isNextRedirect(error: unknown): error is { digest: string } {
  return typeof error === "object" && error !== null && "digest" in error && typeof (error as { digest?: unknown }).digest === "string" && (error as { digest: string }).digest.startsWith("NEXT_REDIRECT");
}

export const signInAction = async (formData: FormData) => {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password"), redirect: formData.get("redirect") || undefined });
  if (!parsed.success) return encodedRedirect("error", "/sign-in", "Enter a valid email address and password.");
  const { email, password } = parsed.data;
  const destination = safeInternalPath(parsed.data.redirect);

  let errorMessage: string | null = null;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.warn("Supabase sign in rejected the request:", error.message);
      errorMessage = "Sign in failed. Check your credentials and try again.";
    }
  } catch (err: unknown) {
    if (isNextRedirect(err)) {
      throw err;
    }
    console.warn("Supabase auth sign in error:", errorDetails(err));
    errorMessage = "Sign in failed. Check your credentials and try again.";
  }

  if (errorMessage) {
    return encodedRedirect("error", `/sign-in?redirect=${encodeURIComponent(destination)}`, errorMessage);
  }

  return redirect(destination);
};

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;

  let errorMessage: string | null = null;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name },
      },
    });

    if (error) {
      console.warn("Supabase sign up rejected the request:", error.message);
      errorMessage = "Sign up failed. Verify your details or sign in if the account already exists.";
    }
  } catch (err: unknown) {
    if (isNextRedirect(err)) {
      throw err;
    }
    console.warn("Supabase auth sign up error:", errorDetails(err));
    errorMessage = "Sign up failed. Please verify your details and try again.";
  }

  if (errorMessage) {
    return encodedRedirect("error", "/sign-up", errorMessage);
  }

  return redirect("/verify-email");
};

export const signOutAction = async () => {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Ignore signout error
  }
  const cookieStore = await cookies();
  cookieStore.delete(DEV_BYPASS_COOKIE);
  return redirect("/");
};
