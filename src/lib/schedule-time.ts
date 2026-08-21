/**
 * Schedule inputs arrive from `datetime-local` fields as bare wall-clock
 * strings ("2026-09-01T18:00"). The product contract is that these values are
 * UTC: organizers are shown "(UTC)" labels wherever they edit schedules, and
 * every stored instant is derived here rather than via bare `new Date(string)`,
 * whose interpretation differs between browsers, local dev servers (local
 * time) and production runtimes (UTC).
 *
 * Explicit offsets in an input ("…T18:00:00+05:30") are honored as written.
 */
const BARE_DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function parseUtcDateTimeInput(
  value: string | null | undefined
): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = BARE_DATETIME_LOCAL.test(trimmed)
    ? `${trimmed}:00Z`
    : trimmed;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}
