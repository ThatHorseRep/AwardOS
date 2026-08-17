import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../helpers/db";

describe("shared rate-limit buckets", () => {
  let db: TestDb;

  beforeAll(async () => { db = await createTestDb(); });
  afterAll(async () => { await db.close(); });

  async function consume(key: string, now: Date, expiresAt: Date) {
    const result = await db.query<{ request_count: number }>(
      `INSERT INTO rate_limit_buckets (key, window_started_at, request_count, expires_at)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (key) DO UPDATE SET
         window_started_at = CASE WHEN rate_limit_buckets.expires_at <= $2 THEN $2 ELSE rate_limit_buckets.window_started_at END,
         request_count = CASE WHEN rate_limit_buckets.expires_at <= $2 THEN 1 ELSE rate_limit_buckets.request_count + 1 END,
         expires_at = CASE WHEN rate_limit_buckets.expires_at <= $2 THEN $3 ELSE rate_limit_buckets.expires_at END
       RETURNING request_count`,
      [key, now, expiresAt] as never[]
    );
    return result.rows[0].request_count;
  }

  it("increments concurrent requests atomically", async () => {
    const now = new Date("2026-08-15T12:00:00Z");
    const expires = new Date(now.getTime() + 60_000);
    const counts = await Promise.all(Array.from({ length: 10 }, () => consume("same-key", now, expires)));
    expect([...counts].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("resets an expired fixed window", async () => {
    const first = new Date("2026-08-15T12:00:00Z");
    await consume("reset-key", first, new Date(first.getTime() + 1_000));
    await consume("reset-key", first, new Date(first.getTime() + 1_000));
    const next = new Date("2026-08-15T12:00:02Z");
    expect(await consume("reset-key", next, new Date(next.getTime() + 1_000))).toBe(1);
  });
});
