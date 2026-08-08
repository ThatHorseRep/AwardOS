/**
 * Sanitizers for text that arrives from untrusted sources — chiefly the public
 * nomination form, which any visitor can post to.
 *
 * These fields are plain text (names, titles, category suggestions), never rich
 * content, so the contract is "no markup at all" rather than "safe markup".
 * That is a stricter and simpler guarantee than an HTML allowlist, which is why
 * there is no DOMPurify-style dependency here: there is no HTML to preserve.
 *
 * Character classes below are written as `\x` escapes rather than literal bytes
 * so that they survive being edited by tools that normalise control characters.
 */

/** Longest nominee/suggestion text accepted. Names are short; anything past this is abuse. */
export const MAX_NOMINEE_TEXT_LENGTH = 200;

/** Longest category-suggestion text accepted. */
export const MAX_SUGGESTION_TEXT_LENGTH = 120;

/**
 * Escape the five XML metacharacters. Required anywhere a value is interpolated
 * into markup that is not built by React — SVG templates, email HTML — since
 * those bypass JSX's automatic escaping entirely.
 */
export function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Remove tag-like constructs and control characters, leaving readable text.
 *
 * Runs to a fixed point because a single pass over `<<b>script>` would leave a
 * usable `<script>` behind. Any surviving angle brackets are dropped outright,
 * so nothing that could later be parsed as a tag remains.
 */
export function stripHtml(value: string): string {
  let text = String(value);

  // Strip whole elements whose content is script/style rather than prose.
  text = text.replace(/<\s*(script|style|iframe|object|embed)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "");

  let previous: string;
  do {
    previous = text;
    text = text.replace(/<[^<>]*>/g, "");
  } while (text !== previous);

  // Leftover brackets from unbalanced input, then control characters — these
  // fields are single-line, so none are worth keeping.
  text = text.replace(/[<>]/g, "");
   
  text = text.replace(/[\x00-\x1F\x7F]/g, " ");

  return text;
}

/**
 * Full input-boundary cleanup for a short free-text field.
 *
 * Returns an empty string when nothing survives, so callers can treat "" as
 * "rejected" without a second check.
 */
export function sanitizePlainText(
  value: unknown,
  maxLength: number = MAX_NOMINEE_TEXT_LENGTH
): string {
  if (typeof value !== "string") {
    return "";
  }

  return stripHtml(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
    .trim();
}

/**
 * Neutralise spreadsheet formula injection.
 *
 * Excel and Sheets evaluate any cell whose text begins with `=`, `+`, `-` or
 * `@`, so an attacker-supplied nominee name like `=HYPERLINK(...)` or
 * `=cmd|'/c calc'!A1` becomes a live formula the moment an organiser opens the
 * export. Prefixing with an apostrophe forces the cell to literal text; the
 * apostrophe itself is not displayed as part of the value.
 */
export function sanitizeSpreadsheetCell<T>(value: T): T | string {
  if (typeof value !== "string" || value.length === 0) {
    return value;
  }

  // A leading tab or carriage return is a trigger in its own right, so it is
  // tested against the raw value before any stripping.
   
  if (/^[\t\r]/.test(value)) {
    return `'${value}`;
  }

  // Other parsers skip leading whitespace and control bytes before evaluating
  // the trigger character, so test the stripped form but keep the original text.
   
  const leading = value.replace(/^[\s\x00-\x1F\x7F]+/, "");
  if (/^[=+\-@]/.test(leading)) {
    return `'${value}`;
  }

  return value;
}

/** Apply `sanitizeSpreadsheetCell` to every value in a row of export records. */
export function sanitizeSpreadsheetRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((row) => {
    const safe: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      safe[key] = sanitizeSpreadsheetCell(value);
    }
    return safe as T;
  });
}
