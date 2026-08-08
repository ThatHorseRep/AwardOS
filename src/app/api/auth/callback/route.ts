import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Paths the auth callback is allowed to send the browser to. */
const ALLOWED_NEXT_PATHS = ["/reset-password", "/dashboard"];

function resolveNext(raw: string | null): string {
  // `startsWith("/") && !startsWith("//")` alone still admits `/\evil.com` and
  // other escapes — the destination has to be one of a short allowlist.
  if (!raw) return "/dashboard";
  return ALLOWED_NEXT_PATHS.includes(raw) ? raw : "/dashboard";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const safeNext = resolveNext(searchParams.get("next"));

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const forwardedHost = request.headers.get("x-forwarded-host");
        const isLocalEnv = process.env.NODE_ENV === "development";
        if (isLocalEnv) {
          return NextResponse.redirect(`${origin}${safeNext}`);
        } else if (forwardedHost) {
          return NextResponse.redirect(`https://${forwardedHost}${safeNext}`);
        } else {
          return NextResponse.redirect(`${origin}${safeNext}`);
        }
      }
    } catch (err) {
      console.error("Auth callback session exchange error:", err);
    }
  }

  // Return the user to sign-in page with error notification
  return NextResponse.redirect(`${origin}/sign-in?error=auth_callback_error`);
}
