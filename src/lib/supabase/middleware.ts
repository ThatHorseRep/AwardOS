import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              request.cookies.set(name, value);
            } catch (err) {
              // Ignore read-only RequestCookies error in Next.js Edge Middleware
            }
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    // Refresh auth user session safely
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isDevBypass = request.cookies.get("awardos_dev_mode")?.value === "true";

    // Protected routes check
    const isProtectedRoute =
      request.nextUrl.pathname.startsWith("/dashboard") ||
      request.nextUrl.pathname.startsWith("/events/") ||
      request.nextUrl.pathname.startsWith("/team") ||
      request.nextUrl.pathname.startsWith("/settings");

    if (isProtectedRoute && !user && !isDevBypass) {
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    // Auth routes check
    const isAuthRoute =
      request.nextUrl.pathname.startsWith("/sign-in") ||
      request.nextUrl.pathname.startsWith("/sign-up");

    if (isAuthRoute && user) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  } catch (err) {
    console.warn("Middleware error handled safely:", err);
  }

  return response;
}
