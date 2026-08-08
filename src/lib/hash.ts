import { createHash } from "crypto";

/**
 * Server-only hashing helpers.
 *
 * These live apart from `lib/utils.ts` on purpose: that module exports `cn`,
 * which nearly every client component imports, so anything sharing the file is
 * pulled toward the client bundle. `node:crypto` has no business there.
 */

/**
 * Salted SHA-256 of a voter-identifying value, truncated to 32 hex chars.
 *
 * The salt is the event slug, so the same IP hashes differently per event and
 * fingerprints cannot be correlated across events.
 */
export function hashIP(ip: string, salt: string): string {
  return createHash("sha256").update(ip + salt).digest("hex").slice(0, 32);
}
