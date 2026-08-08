"use server";

import { createClient } from "@/lib/supabase/server";
import { getFallbackHost } from "@/lib/app-url";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

export const encodedRedirect = async (
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

export const googleSignInAction = async (originUrl?: string) => {
  const cookieStore = await cookies();
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || getFallbackHost();
  const protocol = host.includes("localhost") ? "http" : "https";
  const callbackUrl = `${protocol}://${host}/api/auth/callback`;

  let googleUrl: string | null = null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
      },
    });

    if (error) {
      console.warn("Supabase Google OAuth error:", error.message);
    } else if (data?.url) {
      googleUrl = data.url;
    }
  } catch (err: any) {
    if (err?.digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    console.warn("Google auth initialization error:", err?.message || err);
  }

  if (googleUrl) {
    return redirect(googleUrl);
  }

  return redirect("/sign-in?error=Google%20sign%20in%20unavailable");
};

export const enableDevBypassAction = async () => {
  const cookieStore = await cookies();
  cookieStore.set("awardos_dev_mode", "true", { path: "/", maxAge: 60 * 60 * 24 * 7 });
  return redirect("/dashboard");
};

export const signOutAction = async () => {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (e) {
    // Ignore signout error
  }
  const cookieStore = await cookies();
  cookieStore.delete("awardos_dev_mode");
  return redirect("/");
};
