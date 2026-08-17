import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimitBuckets } from "@/lib/db/schema";

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function consumeRateLimit(scope: string, identifier: string, rule: RateLimitRule): Promise<RateLimitResult> {
  if (!scope || !identifier || rule.limit < 1 || rule.windowMs < 1000) {
    throw new Error("Rate limit configuration is invalid.");
  }

  const key = createHash("sha256").update(`${scope}:${identifier}`).digest("hex");
  const now = new Date();
  const nextExpiry = new Date(now.getTime() + rule.windowMs);
  const nowIso = now.toISOString();
  const nextExpiryIso = nextExpiry.toISOString();
  const result = await db
    .insert(rateLimitBuckets)
    .values({ key, windowStartedAt: now, requestCount: 1, expiresAt: nextExpiry })
    .onConflictDoUpdate({
      target: rateLimitBuckets.key,
      set: {
        windowStartedAt: sql`CASE WHEN ${rateLimitBuckets.expiresAt} <= ${nowIso}::timestamptz THEN ${nowIso}::timestamptz ELSE ${rateLimitBuckets.windowStartedAt} END`,
        requestCount: sql`CASE WHEN ${rateLimitBuckets.expiresAt} <= ${nowIso}::timestamptz THEN 1 ELSE ${rateLimitBuckets.requestCount} + 1 END`,
        expiresAt: sql`CASE WHEN ${rateLimitBuckets.expiresAt} <= ${nowIso}::timestamptz THEN ${nextExpiryIso}::timestamptz ELSE ${rateLimitBuckets.expiresAt} END`,
      },
    })
    .returning({
      request_count: rateLimitBuckets.requestCount,
      expires_at: rateLimitBuckets.expiresAt,
    });

  const row = result[0] as { request_count: number; expires_at: Date | string } | undefined;
  if (!row) throw new Error("Rate limit state could not be recorded.");
  const count = Number(row.request_count);
  const retryAfterSeconds = Math.max(1, Math.ceil((new Date(row.expires_at).getTime() - now.getTime()) / 1000));
  return { allowed: count <= rule.limit, remaining: Math.max(0, rule.limit - count), retryAfterSeconds };
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "Retry-After": String(result.retryAfterSeconds),
    "X-RateLimit-Remaining": String(result.remaining),
  };
}
