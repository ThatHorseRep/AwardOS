import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh auth token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDevBypass = request.cookies.get("awardos_dev_mode")?.value === "true";

  // Protected routes — redirect to sign-in if not authenticated (unless in dev bypass mode)
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname === "/events" ||
    request.nextUrl.pathname.startsWith("/events/") ||
    request.nextUrl.pathname === "/settings" ||
    request.nextUrl.pathname.startsWith("/settings/") ||
    request.nextUrl.pathname.startsWith("/nominations") ||
    request.nextUrl.pathname.startsWith("/voting") ||
    request.nextUrl.pathname.startsWith("/team") ||
    request.nextUrl.pathname.startsWith("/branding") ||
    request.nextUrl.pathname.startsWith("/analytics") ||
    request.nextUrl.pathname.startsWith("/exports") ||
    request.nextUrl.pathname.startsWith("/cleanup") ||
    request.nextUrl.pathname.startsWith("/integrity") ||
    request.nextUrl.pathname.startsWith("/results") ||
    request.nextUrl.pathname.startsWith("/certificates");

  if (isProtectedRoute && !user && !isDevBypass) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Auth routes — redirect to dashboard if already authenticated
  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/sign-in") ||
    request.nextUrl.pathname.startsWith("/sign-up");

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
