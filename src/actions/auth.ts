"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DEV_BYPASS_COOKIE } from "@/lib/dev-mode";

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
  return redirect(`${path}?${type}=${encodeURIComponent(message)}`);
};

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  let errorMessage: string | null = null;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      errorMessage = error.message;
    }
  } catch (err: any) {
    if (err?.digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    console.warn("Supabase auth sign in error:", err?.message || err);
    errorMessage = err?.message || "Sign in failed";
  }

  if (errorMessage) {
    return encodedRedirect("error", "/sign-in", errorMessage);
  }

  return redirect("/dashboard");
};

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;

  let errorMessage: string | null = null;
  let isSuccess = false;

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
      errorMessage = error.message;
    } else {
      isSuccess = true;
    }
  } catch (err: any) {
    if (err?.digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    console.warn("Supabase auth sign up error:", err?.message || err);
    errorMessage = err?.message || "Sign up failed";
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
  } catch (e) {
    // Ignore signout error
  }
  const cookieStore = await cookies();
  cookieStore.delete(DEV_BYPASS_COOKIE);
  return redirect("/");
};
