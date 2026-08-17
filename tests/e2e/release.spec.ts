import { expect, test } from "@playwright/test";

function fixture(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} was not provided by Playwright global setup.`);
  return value;
}

test("landing page is usable, private by design, and has no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Build an award people trust." })).toBeVisible();
  await expect(page.getByText("Events are never listed publicly.")).toBeVisible();
  await expect(page.getByRole("link", { name: /create your first event/i })).toHaveAttribute("href", "/sign-up");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test("keyboard navigation exposes a visible focus target", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toBeVisible();
  const hasFocusIndicator = await focused.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.outlineStyle !== "none" || style.boxShadow !== "none" || style.backgroundColor !== "rgba(0, 0, 0, 0)";
  });
  expect(hasFocusIndicator).toBe(true);
});

test("authentication pages expose labeled fields", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^password$/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeEnabled();
});

test("unknown shared event does not disclose an event directory", async ({ page }) => {
  await page.goto("/e/not-a-real-awardos-event");
  await expect(page.getByRole("heading", { name: /event not found/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/browse events|discover events/i)).toHaveCount(0);
});

test("dashboard shell loads with development bypass", async ({ context, page }) => {
  await context.addCookies([{ name: "awardos_dev_mode", value: "true", url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/dashboard");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Application error");
});

test("security headers are present", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["referrer-policy"]).toBeTruthy();
  expect(response.headers()["permissions-policy"]).toBeTruthy();
  expect(response.headers()["content-security-policy"]).toBeTruthy();
  expect(response.headers()["x-powered-by"]).toBeUndefined();
});

test("reduced motion disables nonessential animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page.locator("main").evaluate((element) => getComputedStyle(element).animationDuration);
  expect(["0s", "0.001s", "1e-05s"]).toContain(duration);
});

test("public nomination flow submits on mobile", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/e/${fixture("E2E_NOMINATION_SLUG")}/nominate`);
  await expect(page.getByRole("heading", { name: "Submit your nominations" })).toBeVisible({ timeout: 45_000 });
  const nomineeInput = page.getByLabel("Nominee full name or organization");
  await nomineeInput.click();
  await nomineeInput.pressSequentially("Kemi Adeyemi", { delay: 20 });
  await expect(nomineeInput).toBeFocused();
  await expect(nomineeInput).toHaveValue("Kemi Adeyemi");
  const [submission] = await Promise.all([
    page.waitForResponse((response) => response.url().includes("/nominations") && response.request().method() === "POST"),
    page.getByRole("button", { name: "Submit nominations" }).click(),
  ]);
  expect(submission.ok(), await submission.text()).toBe(true);
  await expect(page.getByRole("heading", { name: /nominations received/i })).toBeVisible({ timeout: 30_000 });
});

test("public ballot can be reviewed and submitted on mobile", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/e/${fixture("E2E_BALLOT_SLUG")}/vote`);
  await expect(page.getByRole("heading", { name: "Official voter ballot" })).toBeVisible({ timeout: 45_000 });
  await page.getByText("Amara Okafor", { exact: true }).click();
  await page.getByRole("button", { name: "Review ballot" }).click();
  await expect(page.getByRole("dialog", { name: "Review your ballot" })).toBeVisible();
  const reviewOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(reviewOverflow).toBe(false);
  await page.getByRole("dialog").getByRole("button", { name: "Confirm and submit" }).click();
  await expect(page).toHaveURL(/\/vote\/thank-you$/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Vote cast and verified" })).toBeVisible();
  const confirmationOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(confirmationOverflow).toBe(false);
});

test("invitation code gates the ballot and unlocks it once", async ({ page }) => {
  await page.goto(`/e/${fixture("E2E_INVITATION_SLUG")}/vote`);
  await expect(page.getByLabel("Invitation code")).toBeVisible();
  await page.getByLabel("Invitation code").fill(fixture("E2E_INVITATION_CODE"));
  await page.getByRole("button", { name: /authenticate & access ballot/i }).click();
  await expect(page.getByRole("heading", { name: "Official voter ballot" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("status")).toContainText("Identity verified");
});

test("real email OTP delivery advances to code verification", async ({ page }) => {
  test.skip(!process.env.E2E_OTP_EMAIL || !process.env.E2E_OTP_SLUG, "A real OTP recipient was not configured.");
  test.setTimeout(120_000);
  await page.goto(`/e/${fixture("E2E_OTP_SLUG")}/vote`);
  await page.getByLabel("Email address").fill(process.env.E2E_OTP_EMAIL!);
  await page.getByRole("button", { name: "Send access code" }).click();
  await expect(page.getByLabel(/six digit verification code/i)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("status")).toContainText("Verification code sent");
});

test("organizer can open the desktop ballot preview", async ({ context, page }) => {
  await context.addCookies([{ name: "awardos_dev_mode", value: "true", url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await context.addCookies([{ name: "awardos_workspace_id", value: fixture("E2E_WORKSPACE_ID"), url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/events");
  const eventCard = page.getByText(fixture("E2E_BALLOT_EVENT_NAME"), { exact: true }).locator("xpath=ancestor::div[.//a[normalize-space()='Manage']][1]");
  const manageHref = await eventCard.getByRole("link", { name: "Manage" }).getAttribute("href");
  expect(manageHref).toBeTruthy();
  await page.goto(`${manageHref}/ballot-preview`);
  await expect(page.getByRole("heading", { name: "Ballot preview" })).toBeVisible();
  await expect(page.getByRole("region", { name: "desktop ballot preview" })).toBeVisible();
  await expect(page.getByText("Amara Okafor", { exact: true })).toBeVisible();
});
