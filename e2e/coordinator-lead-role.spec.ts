import { test, expect, type Page } from "@playwright/test";

/**
 * SCRUM-164 — the Event Coordinator Lead signs in with its own role. Its queue,
 * reassignment and all-events pages arrive with SCRUM-165, SCRUM-21 and
 * SCRUM-141, so until then it lands on Notifications and can read the venue
 * catalogue (SCRUM-34 AC2), the only things its role allows. The Safety
 * Officer's sign-in is covered by SCRUM-166's spec.
 */
async function signInAsLead(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("lead@test.local");
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test.describe("SCRUM-164 — Event Coordinator Lead role", () => {
  test("SCRUM-164 [AC1, AC4] TC-164-01: the seeded Lead signs in, lands on its home page, and its menu shows only what the role allows", async ({
    page,
  }) => {
    await signInAsLead(page);

    await expect(page).toHaveURL(/\/notifications$/);
    await expect(
      page.getByRole("button", { name: "Open user menu" }),
    ).toContainText("Event Coordinator Lead");

    const rail = page.locator("aside");
    await expect(rail.locator('a[href="/notifications"]')).toHaveCount(1);
    await expect(rail.locator('a[href="/venues"]')).toHaveCount(1);
    await expect(rail.locator("a[href]")).toHaveCount(2);
  });

  for (const url of [
    "/events",
    "/bookings/new",
    "/bookings",
    "/equipment",
    "/registrations",
  ]) {
    test(`SCRUM-164 [AC1, AC3] TC-164-03: the Lead typing ${url} directly is refused`, async ({
      page,
    }) => {
      await signInAsLead(page);

      await page.goto(url);

      await expect(
        page.getByRole("heading", { name: "Access denied" }),
      ).toBeVisible();
    });
  }
});
