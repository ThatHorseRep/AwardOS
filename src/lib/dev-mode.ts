export const DEV_BYPASS_COOKIE = "awardos_dev_mode";

export const DEV_BYPASS_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * The dev bypass cookie skips all authentication, so it must never be honoured
 * outside a local development build. NODE_ENV is inlined at build time by
 * Next.js, so this evaluates statically in both the Node and Edge runtimes.
 */
export function isDevModeAvailable() {
  if (process.env.NODE_ENV === "development") return true;

  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  return (
    process.env.AWARDOS_E2E_BYPASS === "true" &&
    Boolean(testDatabaseUrl) &&
    process.env.DATABASE_URL === testDatabaseUrl
  );
}

export function isDevBypassActive(cookieValue?: string | null) {
  return isDevModeAvailable() && cookieValue === "true";
}
