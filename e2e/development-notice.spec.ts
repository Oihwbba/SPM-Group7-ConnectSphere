import { test, expect, type Page } from "@playwright/test";

/**
 * SCRUM-237 — the sign-in page and every signed-in page say the site is the
 * team's development environment, not a service for customers. Every signed-in
 * page shares app/(app)/layout.tsx, so one landing page per role covers them.
 * It only signs in and looks, so it runs on any database.
 */
const NOTICE =
  "This site is the ConnectSphere team's development environment, used to build and coordinate the project. It isn't a service for customers.";
const PHONE = { width: 375, height: 812 };

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(
    (url) => url.pathname !== "/" && !url.pathname.startsWith("/login"),
  );
  await expect(page.getByRole("main")).not.toBeEmpty();
}

test.describe("SCRUM-237 — the development-environment notice", () => {
  test("SCRUM-237 [AC1, AC4] TC-237-01: the sign-in page says the site is the team's development environment", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(page.getByTestId("development-notice")).toHaveText(NOTICE);
  });

  for (const email of [
    "organiser@test.local",
    "coordinator@test.local",
    "venuestaff@test.local",
    "techsupport@test.local",
    "attendee@test.local",
  ]) {
    test(`SCRUM-237 [AC1, AC4] TC-237-02: ${email} sees the notice above the top bar`, async ({
      page,
    }) => {
      await signIn(page, email);

      const notice = page.getByTestId("development-notice");
      await expect(notice).toHaveText(NOTICE);
      const noticeBox = await notice.boundingBox();
      const barBox = await page.getByRole("banner").boundingBox();
      expect(noticeBox!.y + noticeBox!.height).toBeLessThanOrEqual(barBox!.y + 1);
    });
  }

  test.describe("at phone width", () => {
    test.use({ viewport: PHONE });

    test("SCRUM-237 [AC2] TC-237-03: at 375 px the notice wraps inside the page and leaves the top bar's controls clear", async ({
      page,
    }) => {
      await signIn(page, "coordinator@test.local");

      const notice = page.getByTestId("development-notice");
      await expect(notice).toBeVisible();
      const box = await notice.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(PHONE.width);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(PHONE.width);
      // The bell and the profile menu stay clickable, not covered.
      await page.getByRole("button", { name: "Open user menu" }).click();
      await expect(page.getByRole("menuitem", { name: /sign out/i })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("banner").getByRole("link", { name: /^Notifications,/ }),
      ).toBeVisible();

      // The strip scrolls away while the top bar stays put, so on a long page
      // it never sits over the bar or the content.
      await page.evaluate(() => window.scrollTo(0, 400));
      await expect
        .poll(async () => (await page.getByRole("banner").boundingBox())!.y)
        .toBe(0);
      const scrolled = await notice.boundingBox();
      expect(scrolled!.y + scrolled!.height).toBeLessThanOrEqual(0);
    });
  });
});
