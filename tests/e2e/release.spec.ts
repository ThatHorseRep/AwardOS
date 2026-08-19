import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

function fixture(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} was not provided by Playwright global setup.`);
  return value;
}

async function refreshWorkspaceInviteFixture() {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error("TEST_DATABASE_URL was not provided by Playwright setup.");
  const sql = postgres(testUrl, { max: 1 });
  try {
    const token = fixture("E2E_WORKSPACE_INVITE_TOKEN");
    const workspaceId = fixture("E2E_WORKSPACE_ID");
    const [existing] = await sql<{ id: string }[]>`
      select id from workspace_invites where token = ${token} limit 1
    `;
    if (existing) {
      await sql`
        update workspace_invites
        set uses_count = 0, max_uses = 2, expires_at = now() + interval '1 day'
        where id = ${existing.id}
      `;
    } else {
      await sql`
        insert into workspace_invites
          (workspace_id, role, token, max_uses, uses_count, expires_at, created_by)
        values
          (${workspaceId}, 'EVENT_MANAGER', ${token}, 2, 0,
           now() + interval '1 day', '00000000-0000-0000-0000-000000000000')
      `;
    }
  } finally {
    await sql.end();
  }
}

async function gotoWithHeading(page: Page, url: string, headingName: string | RegExp) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const heading = page.getByRole("heading", {
      name: headingName,
      exact: typeof headingName === "string",
    });
    try {
      await heading.waitFor({ state: "visible", timeout: 30_000 });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.goto("about:blank");
      await page.waitForTimeout(250);
    }
  }
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

test("privacy and terms pages expose complete legal navigation", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Data we process" })).toBeVisible();
  await expect(page.getByRole("link", { name: "AwardOS" })).toHaveAttribute("href", "/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1, name: "Terms of service" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Voting integrity" })).toBeVisible();
  await expect(page.getByRole("link", { name: "AwardOS" })).toHaveAttribute("href", "/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test("authentication support pages expose usable mobile-safe states", async ({ page }) => {
  await page.goto("/sign-up");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  const fullName = page.getByLabel("Full name");
  const signUpPassword = page.locator("input#password");
  await expect(fullName).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(signUpPassword).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(signUpPassword).toHaveAttribute("type", "text");
  expect(await fullName.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);

  await page.goto("/forgot-password");
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  const resetEmail = page.getByLabel("Email address");
  await expect(resetEmail).toBeVisible();
  expect(await resetEmail.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);

  await page.goto("/reset-password");
  await expect(page.getByText(/reset link is invalid or has expired/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: /request a new reset link/i })).toHaveAttribute("href", "/forgot-password");

  await page.goto("/verify-email");
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByRole("link", { name: /back to sign in/i })).toHaveAttribute("href", "/sign-in");
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

test("mobile dashboard navigation is viewport anchored and dismissible", async ({ context, page }) => {
  test.skip(!test.info().project.name.startsWith("mobile"), "Mobile navigation geometry is covered by the mobile project.");
  await context.addCookies([
    { name: "awardos_dev_mode", value: "true", url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" },
    { name: "awardos_workspace_id", value: fixture("E2E_WORKSPACE_ID"), url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" },
  ]);
  await page.goto("/dashboard");
  const menuButton = page.getByRole("button", { name: "Open menu" });
  await expect(menuButton).toBeVisible();
  await menuButton.click();

  const navigation = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(navigation).toBeVisible();
  const bounds = await navigation.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom };
  });
  expect(bounds.top).toBeCloseTo(64, 0);
  expect(bounds.left).toBeCloseTo(0, 0);
  expect(bounds.right).toBeCloseTo(360, 0);
  expect(bounds.bottom).toBeCloseTo(800, 0);
  await expect(navigation.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Events" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

  await page.getByRole("button", { name: "Close navigation" }).click();
  await expect(navigation).toBeHidden();
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

test("public confirmation and populated archive states are usable", async ({ page }) => {
  const slug = fixture("E2E_BALLOT_SLUG");
  await page.goto(`/e/${slug}/nominate/confirmation`);
  await expect(page.getByRole("heading", { name: /nominations received/i })).toBeVisible();
  await page.getByRole("button", { name: /share & promote event/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("link", { name: /return to event page/i })).toHaveAttribute("href", `/e/${slug}`);

  await page.goto("/archive");
  await expect(page.getByRole("link", { name: new RegExp(fixture("E2E_BALLOT_EVENT_NAME"), "i") })).toBeVisible();
  await page.goto(`/archive/${slug}`);
  await expect(page.getByRole("heading", { name: fixture("E2E_BALLOT_EVENT_NAME") })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nominee roster" })).toBeVisible();
  const archiveEmail = page.getByLabel("Your email").first();
  await expect(archiveEmail).toBeVisible();
  expect(await archiveEmail.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await expect(page.getByLabel("Request type").first()).toBeVisible();
  await expect(page.getByLabel("Reason").first()).toBeVisible();
});

test("public results preserve hidden disclosure and unknown-event privacy", async ({ page }) => {
  const slug = fixture("E2E_BALLOT_SLUG");
  await page.goto(`/e/${slug}/results`);
  await expect(page.getByRole("heading", { name: `${fixture("E2E_BALLOT_EVENT_NAME")} results` })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Results are currently locked" })).toBeVisible();
  await expect(page.getByText("Amara Okafor", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/\d+ votes/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /share results/i })).toHaveCount(0);

  await page.goto("/e/not-a-real-awardos-event/results");
  await expect(page.getByRole("heading", { name: "Event not found" })).toBeVisible();
  await expect(page.getByText(/results are currently locked/i)).toHaveCount(0);
});

test("public ballot can be reviewed and submitted on mobile", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/e/${fixture("E2E_BALLOT_SLUG")}/vote`);
  await expect(page.getByRole("heading", { name: "Official voter ballot" })).toBeVisible({ timeout: 45_000 });
  await page.getByText("Amara Okafor", { exact: true }).click();
  await page.getByRole("button", { name: "Review ballot" }).click();
  const reviewDialog = page.getByRole("dialog", { name: "Review your ballot" });
  await expect(reviewDialog).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" }));
  const dialogPosition = await reviewDialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { centerY: rect.top + rect.height / 2, viewportCenterY: window.innerHeight / 2 };
  });
  expect(Math.abs(dialogPosition.centerY - dialogPosition.viewportCenterY)).toBeLessThanOrEqual(2);
  const reviewOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(reviewOverflow).toBe(false);
  await page.getByRole("dialog").getByRole("button", { name: "Confirm and submit" }).click();
  await expect(page).toHaveURL(/\/vote\/thank-you$/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Vote cast and verified" })).toBeVisible();
  const confirmationOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(confirmationOverflow).toBe(false);
});

test("invitation code gates the ballot and unlocks it once", async ({ page }, testInfo) => {
  const codeFixture = testInfo.project.name.startsWith("mobile")
    ? "E2E_MOBILE_INVITATION_CODE"
    : "E2E_DESKTOP_INVITATION_CODE";
  await page.goto(`/e/${fixture("E2E_INVITATION_SLUG")}/vote`);
  await expect(page.getByLabel("Invitation code")).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Invitation code").fill(fixture(codeFixture));
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

test("certificate studio exposes a safe published-winner empty state", async ({ context, page }) => {
  await context.addCookies([{ name: "awardos_dev_mode", value: "true", url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await context.addCookies([{ name: "awardos_workspace_id", value: fixture("E2E_WORKSPACE_ID"), url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/certificates");
  await expect(page.getByRole("heading", { name: "Winner Certificates" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("No published winners yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Print" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Export Certificate" })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test("certificate studio generates a published winner download", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "The mutation-backed download is exercised once; responsive empty-state coverage runs in every project.");
  const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1 });
  let resultId = "";
  let eventId = "";
  try {
    const [row] = await sql<{ eventId: string; categoryId: string; nomineeId: string }[]>`
      select e.id as "eventId", c.id as "categoryId", n.id as "nomineeId"
      from events e
      inner join categories c on c.event_id = e.id
      inner join nominees n on n.category_id = c.id
      where e.slug = ${fixture("E2E_NOMINATION_SLUG")}
      order by c.display_order, n.display_order
      limit 1
    `;
    eventId = row.eventId;
    await sql`update events set live_results_mode = 'FULL_LEADERBOARD' where id = ${eventId}`;
    const [result] = await sql<{ id: string }[]>`
      insert into official_results
        (event_id, category_id, nominee_id, raw_vote_count, adjusted_vote_count, final_rank, is_winner, is_disqualified)
      values (${row.eventId}, ${row.categoryId}, ${row.nomineeId}, 1, 1, 1, true, false)
      returning id
    `;
    resultId = result.id;

    await context.addCookies([{ name: "awardos_dev_mode", value: "true", url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
    await context.addCookies([{ name: "awardos_workspace_id", value: fixture("E2E_WORKSPACE_ID"), url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
    await page.goto("/certificates");
    await expect(page.getByLabel("Published winner")).toHaveValue(resultId, { timeout: 30_000 });
    await expect(page.getByLabel("Recipient / Winner Name")).toHaveValue("Amara Okafor");
    await expect(page.getByRole("button", { name: "Print" })).toBeEnabled();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export Certificate" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("Amara_Okafor_Certificate.svg");
  } finally {
    if (resultId) await sql`delete from official_results where id = ${resultId}`;
    if (eventId) await sql`update events set live_results_mode = 'HIDDEN' where id = ${eventId}`;
    await sql.end();
  }
});

test("organizer can create an event and restore a recoverable event", async ({ context, page }, testInfo) => {
  test.setTimeout(120_000);
  await context.addCookies([{ name: "awardos_dev_mode", value: "true", url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await context.addCookies([{ name: "awardos_workspace_id", value: fixture("E2E_WORKSPACE_ID"), url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);

  const eventName = `E2E Created Event ${Date.now()}`;
  await page.goto("/events/new");
  const titleInput = page.getByLabel("Event Title *");
  await expect(titleInput).toBeVisible();
  await expect.poll(() => titleInput.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

  if (testInfo.project.name !== "desktop-chromium") {
    await page.goto("/events/deleted");
    await expect(page.getByText("No deleted events are awaiting recovery.")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    return;
  }

  await titleInput.fill(eventName);
  await expect(page.getByLabel("Public URL Slug")).toHaveValue(/e2e-created-event-/);
  await page.getByRole("button", { name: /continue to step 02/i }).click();
  await expect(page.getByLabel("Nominations Open")).toBeVisible();
  await page.getByRole("button", { name: /continue to step 03/i }).click();
  await page.getByRole("button", { name: "Recognition program" }).click();
  await expect(page.getByText("Leadership", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /continue to step 04/i }).click();
  await expect(page.getByLabel("Target Audience")).toBeVisible();
  await page.getByRole("button", { name: /launch event program/i }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]+$/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: eventName })).toBeVisible({ timeout: 30_000 });

  await page.goto("/events/deleted");
  const deletedName = fixture("E2E_DELETED_EVENT_NAME");
  const deletedCard = page.getByText(deletedName, { exact: true }).locator("xpath=ancestor::div[contains(@class,'flex')][1]");
  await expect(deletedCard.getByRole("button", { name: "Restore" })).toBeEnabled();
  await deletedCard.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("status")).toContainText("Event restored");
  await expect(page.getByText(deletedName, { exact: true })).toHaveCount(0);
});

test("event management surfaces expose nomination and cleanup states", async ({ context, page }, testInfo) => {
  test.setTimeout(120_000);
  await context.addCookies([{ name: "awardos_dev_mode", value: "true", url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await context.addCookies([{ name: "awardos_workspace_id", value: fixture("E2E_WORKSPACE_ID"), url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  const eventId = fixture("E2E_BALLOT_EVENT_ID");
  const eventName = fixture("E2E_BALLOT_EVENT_NAME");

  await page.goto(`/events/${eventId}`);
  await expect(page.getByRole("heading", { name: eventName })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

  await page.goto(`/events/${eventId}/nominations`);
  await expect(page.getByRole("heading", { name: "Nomination review" })).toBeVisible();
  await expect(page.getByText("Amara Okafor", { exact: true })).toBeVisible();
  await expect(page.getByText("David Mensah", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Raw submissions" }).click();
  await expect(page.getByText("No nominations have been submitted for this event.")).toBeVisible();
  await page.getByRole("button", { name: "Suggested categories" }).click();
  const pendingSuggestion = page.getByText("Community champion", { exact: true });
  if (await pendingSuggestion.count()) {
    await expect(pendingSuggestion).toBeVisible();
  } else {
    await expect(page.getByText("No category suggestions await review.")).toBeVisible();
  }

  if (testInfo.project.name === "desktop-chromium") {
    const managedNomineeName = `E2E Managed Nominee ${Date.now()}`;
    await page.getByRole("button", { name: "Manage nominees" }).click();
    await page.getByRole("button", { name: "Add nominee", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Add nominee" })).toBeVisible();
    await page.getByRole("dialog").getByLabel("Name").fill(managedNomineeName);
    await page.getByRole("dialog").getByRole("button", { name: "Save nominee" }).click();
    await expect(page.getByRole("status")).toContainText("Nominee saved");
    await expect(page.getByText(managedNomineeName, { exact: true })).toBeVisible();
  }

  await page.goto(`/events/${eventId}/suggested-categories`);
  await expect(page.getByRole("heading", { level: 1, name: /Suggested Categories Inbox/i })).toBeVisible();
  const approveSuggestion = page.getByRole("button", { name: "Approve" });
  if (testInfo.project.name === "desktop-chromium" && await approveSuggestion.count()) {
    await approveSuggestion.click();
    const categoryName = page.getByLabel("Category Name");
    await expect(categoryName).toHaveValue("Community champion");
    expect(await categoryName.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await page.getByRole("button", { name: "Create & Approve" }).click();
    await expect(page.getByText("Suggested Categories Inbox Empty")).toBeVisible();
  } else {
    await expect(page.getByText("Suggested Categories Inbox Empty")).toBeVisible();
  }

  await page.goto(`/events/${eventId}/ai-cleanup`);
  await expect(page.getByRole("heading", { name: /AI Nomination Cleanup Hub/i })).toBeVisible();
  await expect(page.getByText("Deduplicate Nominations with AI")).toBeVisible();
  await expect(page.getByRole("button", { name: "Run Initial AI Analysis" })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test("event results expose authoritative populated tallies", async ({ context, page }) => {
  await context.addCookies([{ name: "awardos_dev_mode", value: "true", url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await context.addCookies([{ name: "awardos_workspace_id", value: fixture("E2E_WORKSPACE_ID"), url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  const eventId = fixture("E2E_BALLOT_EVENT_ID");
  await page.goto(`/events/${eventId}/results`);
  await expect(page.getByRole("heading", { name: /Official Results & Tally Board/i })).toBeVisible();
  await expect(page.getByText("Amara Okafor", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Public Results Link" })).toHaveAttribute("href", new RegExp(`/e/${fixture("E2E_BALLOT_SLUG")}/results$`));
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

  await expect(page.getByLabel("Special award title")).toBeVisible();
  await expect(page.getByLabel("Special award recipient")).toBeVisible();
  await expect(page.getByLabel("Special award citation")).toBeVisible();
});

test("event analytics expose canonical submitted-ballot metrics", async ({ context, page }) => {
  await context.addCookies([{ name: "awardos_dev_mode", value: "true", url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await context.addCookies([{ name: "awardos_workspace_id", value: fixture("E2E_WORKSPACE_ID"), url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  const eventId = fixture("E2E_BALLOT_EVENT_ID");
  await page.goto(`/events/${eventId}/analytics`);
  await expect(page.getByRole("heading", { name: "Voting Activity & Analytics" })).toBeVisible();
  await expect(page.getByText("Valid submitted ballot sessions")).toBeVisible();
  await expect(page.getByText("Community impact", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /view vote totals/i })).toHaveAttribute("href", `/events/${eventId}/results`);
  await expect(page.getByRole("link", { name: /review submitted ballots/i })).toHaveAttribute("href", `/events/${eventId}/integrity`);
});

test("event integrity exposes submitted sessions and audit scanning", async ({ context, page }, testInfo) => {
  await context.addCookies([{ name: "awardos_dev_mode", value: "true", url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await context.addCookies([{ name: "awardos_workspace_id", value: fixture("E2E_WORKSPACE_ID"), url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  const eventId = fixture("E2E_BALLOT_EVENT_ID");
  await gotoWithHeading(page, `/events/${eventId}/integrity`, /Voting Integrity Dashboard/i);
  await expect(page.getByText("Active ballot sessions submitted")).toBeVisible();
  if (testInfo.project.name === "desktop-chromium") {
    await page.getByRole("button", { name: "Run Integrity Audit" }).click();
    await expect(page.getByText(/Audit scan completed!/i)).toBeVisible();
  }
});

test("event exports create an immutable official-results download", async ({ context, page }, testInfo) => {
  test.setTimeout(120_000);
  await context.addCookies([{ name: "awardos_dev_mode", value: "true", url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await context.addCookies([{ name: "awardos_workspace_id", value: fixture("E2E_WORKSPACE_ID"), url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  const eventId = fixture("E2E_BALLOT_EVENT_ID");
  await gotoWithHeading(page, `/events/${eventId}/exports`, "Exports");
  const officialResultsCard = page.getByRole("heading", { name: "Official results" }).locator("xpath=ancestor::div[contains(@class,'rounded')][1]");
  await expect(officialResultsCard.getByRole("button", { name: "JSON" })).toBeEnabled();
  if (testInfo.project.name === "desktop-chromium") {
    const downloadPromise = page.waitForEvent("download");
    await officialResultsCard.getByRole("button", { name: "JSON" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/official_results.*\.json/i);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test("invitations, branding, and archive settings remain usable", async ({ context, page }, testInfo) => {
  test.setTimeout(120_000);
  await context.addCookies([{ name: "awardos_dev_mode", value: "true", url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await context.addCookies([{ name: "awardos_workspace_id", value: fixture("E2E_WORKSPACE_ID"), url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);

  await page.goto(`/events/${fixture("E2E_INVITATION_EVENT_ID")}/invitations`);
  await expect(page.getByRole("heading", { name: /Event Voter PINs & Invitation Codes/i })).toBeVisible();
  await expect(page.getByLabel("Quantity (1 - 500)")).toHaveValue("25");
  await expect(page.getByLabel("Expiration Schedule")).toBeVisible();
  if (testInfo.project.name === "desktop-chromium") {
    await page.getByLabel("Quantity (1 - 500)").fill("2");
    await page.getByLabel("Code Prefix Tag (Optional)").fill("QA");
    await page.getByRole("button", { name: "Generate 2 Voter PINs" }).click();
    await expect(page.getByText(/4 Total|2 Total/)).toBeVisible();
  }

  const eventId = fixture("E2E_BALLOT_EVENT_ID");
  await page.goto(`/events/${eventId}/branding`);
  await expect(page.getByRole("heading", { name: /Event Branding Studio/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Live Portal Preview" })).toBeVisible();
  await expect(page.getByText("Primary Theme Color", { exact: true })).toBeVisible();

  await page.goto(`/events/${eventId}/archive`);
  await expect(page.getByRole("heading", { name: "Archive settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Archive visibility" })).toBeVisible();
  await expect(page.getByText("Nominee privacy requests")).toBeVisible();
  await expect(page.getByText("No privacy requests.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test("workspace operational roll-ups expose populated navigation", async ({ context, page }) => {
  test.setTimeout(240_000);
  await context.addCookies([{ name: "awardos_dev_mode", value: "true", url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await context.addCookies([{ name: "awardos_workspace_id", value: fixture("E2E_WORKSPACE_ID"), url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);

  const surfaces = [
    ["/nominations", "Nominations & category inbox"],
    ["/voting", "Voting & ballot control center"],
    ["/results", "Official Results & Tally Center"],
    ["/analytics", "Real-Time Analytics & Telemetry Directory"],
    ["/exports", "Workspace Data Exporter Hub"],
    ["/branding", "Branding & theme studio"],
    ["/cleanup", "AI nomination cleanup engine"],
    ["/integrity", "Voting integrity"],
  ] as const;

  for (const [route, heading] of surfaces) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  }
});

test("workspace invitation and settings directories expose usable states", async ({ context, page }) => {
  test.setTimeout(120_000);

  await refreshWorkspaceInviteFixture();
  await gotoWithHeading(page, `/invite/${fixture("E2E_WORKSPACE_INVITE_TOKEN")}`, /AwardOS browser tests/i);
  await expect(page.getByText("EVENT_MANAGER", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /accept invitation/i })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

  await context.addCookies([{ name: "awardos_dev_mode", value: "true", url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await context.addCookies([{ name: "awardos_workspace_id", value: fixture("E2E_WORKSPACE_ID"), url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Workspace settings" })).toBeVisible();
  await expect(page.getByRole("link", { name: /User profile and avatar/i })).toHaveAttribute("href", "/settings/profile");
  await expect(page.getByRole("link", { name: /AI assistant provider/i })).toHaveAttribute("href", "/settings/ai");
  await expect(page.getByRole("link", { name: /Account deletion/i })).toHaveAttribute("href", "/settings/account");

  await page.goto("/settings/ai");
  await expect(page.getByRole("heading", { name: "AI provider status" })).toBeVisible();
  await expect(page.getByText("Provider credentials are deployment secrets")).toBeVisible();
  await expect(page.getByText(/Default provider:/)).toBeVisible();

  await page.goto("/branding");
  await expect(page.getByRole("heading", { name: "Branding & theme studio" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Customize event branding/i }).first()).toHaveAttribute("href", /\/events\/.+\/branding/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test("voting hub saves and restores ballot settings", async ({ context, page }) => {
  test.setTimeout(180_000);
  await context.addCookies([{ name: "awardos_dev_mode", value: "true", url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await context.addCookies([{ name: "awardos_workspace_id", value: fixture("E2E_WORKSPACE_ID"), url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);

  await page.goto("/voting");
  const eventRow = page.getByText(fixture("E2E_BALLOT_EVENT_NAME"), { exact: true }).locator("xpath=ancestor::div[.//button[normalize-space()='Ballot settings']][1]");
  await eventRow.getByRole("button", { name: "Ballot settings" }).click();
  const visibility = page.getByLabel("Program visibility");
  const originalVisibility = await visibility.inputValue();
  const temporaryVisibility = originalVisibility === "PRIVATE" ? "UNLISTED" : "PRIVATE";
  await visibility.selectOption(temporaryVisibility);
  await page.getByRole("button", { name: "Save ballot settings" }).click();
  await expect(page.getByText("Ballot settings saved")).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });

  await eventRow.getByRole("button", { name: "Ballot settings" }).click();
  await expect(page.getByLabel("Program visibility")).toHaveValue(temporaryVisibility);
  await page.getByLabel("Program visibility").selectOption(originalVisibility);
  await page.getByRole("button", { name: "Save ballot settings" }).click();
  await expect(page.getByText("Ballot settings saved")).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
});

test("profile settings save and restore a display name", async ({ context, page }) => {
  await context.addCookies([{ name: "awardos_dev_mode", value: "true", url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await context.addCookies([{ name: "awardos_workspace_id", value: fixture("E2E_WORKSPACE_ID"), url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/settings/profile");
  const displayName = page.getByLabel("Full display name");
  const original = await displayName.inputValue();
  const changed = `${original} E2E`;
  await displayName.fill(changed);
  await page.getByRole("button", { name: "Save profile changes" }).click();
  await expect(page.getByText("Profile updated successfully!", { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(displayName).toHaveValue(changed);
  await displayName.fill(original);
  await page.getByRole("button", { name: "Save profile changes" }).click();
  await expect(page.getByText("Profile updated successfully!", { exact: true })).toBeVisible({ timeout: 30_000 });
});

test("team workspace can generate and revoke an invitation link", async ({ context, page }) => {
  await context.addCookies([{ name: "awardos_dev_mode", value: "true", url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await context.addCookies([{ name: "awardos_workspace_id", value: fixture("E2E_WORKSPACE_ID"), url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/team");
  await page.getByRole("button", { name: /Generate invite link/i }).click();
  await expect(page.getByText("Workspace invitation studio")).toBeVisible();
  await page.getByRole("button", { name: /Create invitation link/i }).click();
  await expect(page.getByText(/Invitation link generated/i)).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Close modal" }).click();
  await page.getByRole("button", { name: /Invitations & links/i }).click();
  const inviteCard = page.getByText(/Role: EVENT_MANAGER/i).last().locator("xpath=ancestor::div[.//button[contains(normalize-space(), 'Revoke')]][1]");
  page.once("dialog", (dialog) => void dialog.accept());
  await inviteCard.getByRole("button", { name: /Revoke/i }).click();
  await expect(inviteCard).toHaveCount(0);
});

test("event overview exposes workflow timeline save without changing stage", async ({ context, page }) => {
  await context.addCookies([{ name: "awardos_dev_mode", value: "true", url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await context.addCookies([{ name: "awardos_workspace_id", value: fixture("E2E_WORKSPACE_ID"), url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await page.goto(`/events/${fixture("E2E_BALLOT_EVENT_ID")}?tab=workflow`);
  await expect(page.getByRole("heading", { name: /Event schedule & stage timeline editor/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Save timeline" })).toBeEnabled();
  await page.getByRole("button", { name: "Save timeline" }).click();
  await expect(page.getByText(/Timeline updated/i)).toBeVisible({ timeout: 30_000 });
});

test("account recovery restores a seeded deletion-grace state", async ({ context, page }) => {
  const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1 });
  const scheduledFor = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  try {
    await sql`update users set deletion_requested_at = now(), deletion_scheduled_for = ${scheduledFor}, deleted_at = null where id = '00000000-0000-0000-0000-000000000000'`;
  } finally {
    await sql.end();
  }
  await context.addCookies([{ name: "awardos_dev_mode", value: "true", url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/account/recover");
  await expect(page.getByRole("heading", { name: "This account is scheduled for deletion" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Restore my account" })).toBeEnabled();
  await page.getByRole("button", { name: "Restore my account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
});

test("account settings expose deletion impact without scheduling deletion", async ({ context, page }) => {
  await context.addCookies([{ name: "awardos_dev_mode", value: "true", url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await context.addCookies([{ name: "awardos_workspace_id", value: fixture("E2E_WORKSPACE_ID"), url: "http://127.0.0.1:3100", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/settings/account");
  await expect(page.getByRole("heading", { name: "Account & data" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Delete your account" })).toBeVisible();
  await expect(page.getByText("Activity history — kept, but anonymized")).toBeVisible();
  const continueButton = page.getByRole("button", { name: "Continue to delete my account" });
  await expect(continueButton).toBeDisabled();
  await expect(page.getByText(/Deletion is blocked until these are resolved/i)).toBeVisible();
  await expect(page.locator("#main-content").getByRole("link", { name: "Members" })).toHaveAttribute("href", "/team");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});
