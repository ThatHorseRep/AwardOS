/**
 * Shared mapping of ballot-submission failures to voter-facing HTTP responses.
 *
 * Extracted from the votes route so the mapping is regression-testable: the
 * route previously read `error.code` directly, but every query failure through
 * drizzle-orm arrives wrapped in DrizzleQueryError with the original PG error
 * on `.cause` — so genuine unique-constraint conflicts (the database backstop
 * for concurrent duplicate ballots) were served as HTTP 500 instead of 409.
 *
 * PGlite names the constraint field `constraint`; postgres-js names it
 * `constraint_name`. Both are accepted.
 */

type PgErrorShape = {
  code?: unknown;
  constraint_name?: unknown;
  constraint?: unknown;
};

type Wrapped = PgErrorShape & { cause?: unknown };

function unwrapPgError(error: unknown): PgErrorShape | null {
  let current = error as Wrapped | null | undefined;
  for (let depth = 0; current && depth < 4; depth += 1) {
    if (typeof current.code === "string") return current;
    current = (current.cause as Wrapped) ?? null;
  }
  return null;
}

export function mapBallotSubmitError(
  error: unknown
): { status: number; body: { error: string } } | null {
  const pg = unwrapPgError(error);
  if (pg && pg.code === "23505") {
    // The partial unique indexes on vote_sessions are the real one-ballot-per-
    // voter enforcement; reaching here means a racer lost that race cleanly.
    const constraint =
      [pg.constraint_name, pg.constraint].find((v) => typeof v === "string") ?? "";
    const message = String(constraint).includes("event_email")
      ? "A ballot has already been submitted with this email address."
      : String(constraint).includes("event_fingerprint")
      ? "A ballot from this device has already been submitted for this event."
      : "You have already cast a ballot for this event.";
    return { status: 409, body: { error: message } };
  }

  const message = error instanceof Error ? error.message : "Unable to submit ballot.";

  // Rejections raised inside the transaction are voter-facing rules, not
  // server faults.
  if (/already/i.test(message)) return { status: 409, body: { error: message } };
  if (/too many/i.test(message)) return { status: 429, body: { error: message } };
  if (/required|invalid|expired|not eligible|at least one|no longer/i.test(message)) {
    return { status: 400, body: { error: message } };
  }

  return null;
}
