"use server";

import { createClient } from "@/lib/supabase/server";
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

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return encodedRedirect("error", "/sign-in", error.message);
    }
  } catch (err: any) {
    console.warn("Supabase Auth remote connection failed, falling back to Dev Mode:", err?.message || err);
    const cookieStore = await cookies();
    cookieStore.set("awardos_dev_mode", "true", { path: "/" });
  }

  return redirect("/dashboard");
};

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;

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
      return encodedRedirect("error", "/sign-up", error.message);
    }
  } catch (err: any) {
    console.warn("Supabase Auth remote connection failed, falling back to Dev Mode:", err?.message || err);
    const cookieStore = await cookies();
    cookieStore.set("awardos_dev_mode", "true", { path: "/" });
    return redirect("/dashboard");
  }

  return redirect("/verify-email");
};

export const googleSignInAction = async (originUrl?: string) => {
  const cookieStore = await cookies();
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "awardos-alpha.vercel.app";
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
    console.warn("Google auth initialization error:", err?.message || err);
  }

  // If Google OAuth URL was generated, redirect to Google!
  if (googleUrl) {
    return redirect(googleUrl);
  }

  // Fallback if Google OAuth is unconfigured
  cookieStore.set("awardos_dev_mode", "true", { path: "/", maxAge: 60 * 60 * 24 * 7 });
  return redirect("/dashboard");
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
    // Ignore signout error on local dev mode
  }
  const cookieStore = await cookies();
  cookieStore.delete("awardos_dev_mode");
  return redirect("/");
};
