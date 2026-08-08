/**
 * Account deletion constants shared between server actions and client UI.
 *
 * Kept free of server-only imports so the confirmation screens can import the
 * copy and the grace-window length without pulling in the database client.
 */

/**
 * FR-AUTH-06 requires full PII removal within 30 days of the request. We use the
 * whole window as a recovery period: access is revoked the moment the request is
 * made, but nothing is erased until the window closes, so a user who was
 * pressured or compromised can still get their data back.
 */
export const ACCOUNT_DELETION_GRACE_DAYS = 30;

/** Phrase the user must type verbatim to arm the delete button. */
export const ACCOUNT_DELETION_CONFIRM_PHRASE = "DELETE MY ACCOUNT";

/** Domain used for anonymized email addresses. Reserved by RFC 6761 — unroutable. */
export const ANONYMIZED_EMAIL_DOMAIN = "deleted.invalid";

/** Display name left on anonymized rows so audit trails stay readable. */
export const ANONYMIZED_DISPLAY_NAME = "Deleted User";

export function deletionScheduledDateFrom(requestedAt: Date): Date {
  const scheduled = new Date(requestedAt);
  scheduled.setUTCDate(scheduled.getUTCDate() + ACCOUNT_DELETION_GRACE_DAYS);
  return scheduled;
}

/**
 * Stable anonymized address for a purged account. Deriving it from the user id
 * keeps the `users.email` unique constraint satisfied and makes the purge
 * idempotent — re-running it produces the same value.
 */
export function anonymizedEmailFor(userId: string): string {
  return `deleted+${userId}@${ANONYMIZED_EMAIL_DOMAIN}`;
}
