/**
 * Client IP resolution for public, unauthenticated routes.
 *
 * `x-forwarded-for` is a client-supplied header. Anyone can send one, and any
 * value they put there lands at the front of the list — so trusting the first
 * entry lets a voter mint a new IP per request and defeat IP-based limits.
 *
 * On Vercel, `x-vercel-forwarded-for` is set by the platform and cannot be
 * overridden by the caller, so it is preferred whenever present. The
 * `x-forwarded-for` fallback exists for self-hosted and local runs, where the
 * *last* entry is the one the nearest trusted proxy observed.
 */
const MAX_IP_LENGTH = 255;

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function lastHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const parts = value.split(",");
  const last = parts[parts.length - 1]?.trim();
  return last || null;
}

export function getClientIp(headers: Headers): string {
  const candidate =
    firstHeaderValue(headers.get("x-vercel-forwarded-for")) ??
    firstHeaderValue(headers.get("x-real-ip")) ??
    lastHeaderValue(headers.get("x-forwarded-for")) ??
    "127.0.0.1";

  // ip_address is varchar(255). A long forged header would otherwise raise a
  // Postgres length error and surface to the voter as a 500.
  return candidate.slice(0, MAX_IP_LENGTH);
}
