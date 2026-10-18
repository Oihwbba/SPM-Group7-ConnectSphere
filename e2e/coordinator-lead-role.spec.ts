import { test, expect, type Page } from "@playwright/test";

/**
 * SCRUM-164 — the Event Coordinator Lead signs in with its own role and lands
 * on its home page, the Unassigned queue (SCRUM-165). The Safety Officer's
 * sign-in is covered by SCRUM-166's spec.
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

    await expect(page).toHaveURL(/\/queue$/);
    await expect(
      page.getByRole("button", { name: "Open user menu" }),
    ).toContainText("Event Coordinator Lead");

    const rail = page.locator("aside");
    await expect(rail.locator('a[href="/queue"]')).toHaveCount(1);
    await expect(rail.locator('a[href="/notifications"]')).toHaveCount(1);
    await expect(rail.locator('a[href="/venues"]')).toHaveCount(1);
    await expect(rail.locator("a[href]")).toHaveCount(3);
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
