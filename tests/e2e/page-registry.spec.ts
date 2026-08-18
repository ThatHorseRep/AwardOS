import { expect, test } from "@playwright/test";

function fixture(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} was not provided by Playwright global setup.`);
  return value;
}

function registeredRoutes() {
  const eventId = fixture("E2E_BALLOT_EVENT_ID");
  const eventSlug = fixture("E2E_BALLOT_SLUG");
  const nomineeId = fixture("E2E_BALLOT_NOMINEE_ID");

  return [
    "/",
    "/forgot-password",
    "/reset-password",
    "/sign-in",
    "/sign-up",
    "/verify-email",
    "/analytics",
    "/branding",
    "/certificates",
    "/cleanup",
    "/dashboard",
    `/events/${eventId}/ai-cleanup`,
    `/events/${eventId}/analytics`,
    `/events/${eventId}/archive`,
    `/events/${eventId}/ballot-preview`,
    `/events/${eventId}/branding`,
    `/events/${eventId}/exports`,
    `/events/${eventId}/integrity`,
    `/events/${eventId}/invitations`,
    `/events/${eventId}/nominations`,
    `/events/${eventId}`,
    `/events/${eventId}/results`,
    `/events/${eventId}/suggested-categories`,
    "/events/deleted",
    "/events/new",
    "/events",
    "/exports",
    "/integrity",
    "/nominations",
    "/results",
    "/settings/account",
    "/settings/ai",
    "/settings",
    "/settings/profile",
    "/team",
    "/voting",
    "/archive/not-a-real-archive",
    "/archive",
    `/e/${eventSlug}/nominate/confirmation`,
    `/e/${eventSlug}/nominate`,
    `/e/${eventSlug}`,
    `/e/${eventSlug}/results`,
    `/e/${eventSlug}/vote`,
    `/e/${eventSlug}/vote/thank-you`,
    `/embed/nominee/${nomineeId}`,
    "/invite/not-a-real-invitation",
    "/account/recover",
    "/privacy",
    "/terms",
  ];
}

test("all 49 registered pages render without application errors or horizontal overflow", async ({ context, page }) => {
  test.setTimeout(12 * 60_000);
  await context.addCookies([
    { name: "awardos_dev_mode", value: "true", url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" },
    { name: "awardos_workspace_id", value: fixture("E2E_WORKSPACE_ID"), url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" },
  ]);

  const routes = registeredRoutes();
  expect(routes).toHaveLength(49);

  for (const route of routes) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 60_000 });
    expect(response?.status(), `${route} should return a non-error HTTP status`).toBeLessThan(400);
    await expect(page.locator("body"), `${route} should render a body`).toBeVisible();
    await expect(page.locator("body"), `${route} should not render an application error`).not.toContainText("Application error");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow, `${route} should not overflow horizontally at this viewport`).toBe(false);
  }
});
