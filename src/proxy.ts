import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { VOTED_COOKIE_PREFIX } from "@/lib/voting-cookie";

export async function proxy(request: NextRequest) {
  // API routes perform their own authentication, cron-secret validation, or
  // public rate limiting. Passing their POST bodies through Supabase's session
  // refresh can consume the request stream before the route handler reads it.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const response = await updateSession(request);

  // Self-heal legacy root-scoped ballot cookies.
  //
  // These were originally written at path "/" with a one-year lifetime, so every
  // ballot a person had ever cast rode along on every request to the domain and
  // accumulated without bound — eventually pushing the request past the edge's
  // header limit and returning 494 REQUEST_HEADER_TOO_LARGE before any app code
  // runs. Scoping new cookies to /e/<slug> stops the growth, but cannot remove
  // what browsers already stored, so they are expired here.
  //
  // A request does not carry the path a cookie was set with, so the legacy ones
  // are indistinguishable by inspection. Deleting at path "/" is still safe and
  // targeted: cookie removal is path-specific, so this clears only the
  // root-scoped copy and leaves the current /e/<slug> cookie untouched.
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith(VOTED_COOKIE_PREFIX)) {
      response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     * - API public routes are handled inside the middleware logic
     */
    "/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
