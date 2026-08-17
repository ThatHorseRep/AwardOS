import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { DEV_BYPASS_COOKIE, isDevBypassActive } from "@/lib/dev-mode";

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
          cookiesToSet.forEach(({ name, value }) =>
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

  /**
   * Carry Supabase's refreshed auth cookies onto a redirect.
   *
   * `NextResponse.redirect()` builds a brand-new response, so returning one
   * directly discarded every cookie `setAll` had just written to
   * `supabaseResponse`. The refreshed session was therefore never persisted:
   * the next request arrived with the same stale token, Supabase refreshed and
   * re-issued cookies again, and that response was discarded again.
   *
   * On a protected route that becomes a redirect loop, and each pass leaves
   * another set of chunked `sb-*-auth-token.N` cookies behind. They accumulate
   * until the request exceeds the edge's header limit and the whole domain
   * starts returning 494 REQUEST_HEADER_TOO_LARGE — including for a brand-new
   * private window, because the loop rebuilds them from scratch every time.
   */
  const redirectTo = (pathname: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const response = NextResponse.redirect(url);
    for (const cookie of supabaseResponse.cookies.getAll()) {
      response.cookies.set(cookie);
    }
    return response;
  };

  // Dev bypass is only honoured in a local development build — never in
  // preview or production, where the cookie is ignored entirely.
  const isDevBypass = isDevBypassActive(
    request.cookies.get(DEV_BYPASS_COOKIE)?.value
  );

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
    return redirectTo("/sign-in", { redirect: request.nextUrl.pathname });
  }

  // Auth routes — redirect to dashboard if already authenticated.
  // `/reset-password` is deliberately absent: completing a reset requires the
  // recovery session the callback just established, so bouncing a signed-in
  // user away from it would break the flow it exists to finish.
  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/sign-in") ||
    request.nextUrl.pathname.startsWith("/sign-up") ||
    request.nextUrl.pathname.startsWith("/forgot-password");

  if (isAuthRoute && user) {
    return redirectTo("/dashboard");
  }

  return supabaseResponse;
}
