import { createHash, randomInt, timingSafeEqual } from "crypto";

/** Wrong guesses allowed per issued code before it is burned. */
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000;

/**
 * Voting credentials are generated with the CSPRNG, not `Math.random()`.
 * `Math.random()` is a deterministic PRNG seeded from process state: observing a
 * few outputs can reveal the internal state and let an attacker predict the
 * codes issued to other voters.
 */
export function generateOtpCode(): string {
  const max = 10 ** OTP_LENGTH;
  return randomInt(0, max).toString().padStart(OTP_LENGTH, "0");
}

/**
 * Codes are stored as SHA-256 digests. Plain SHA-256 is the right primitive
 * here rather than a slow KDF: the input is high-entropy relative to its
 * lifetime (a 6-digit code that dies in 10 minutes after 5 attempts), so the
 * property that matters is that a database read does not yield usable codes.
 */
export function hashOtpCode(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}

/** Constant-time comparison so verification latency cannot leak the digest. */
export function otpHashMatches(candidate: string, stored: string): boolean {
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(stored, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}
