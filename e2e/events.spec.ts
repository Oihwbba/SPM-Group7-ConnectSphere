import { test, expect } from "@playwright/test";

/**
 * End-to-end happy path for the reference feature: sign in as the seeded
 * organiser, land on the events list, create a draft, and see it appear in the
 * table. This requires the seeded database (npm run db:reset) and the built
 * app — CI does both before running Playwright.
 */
test("organiser signs in, views their events, and creates a draft", async ({
  page,
}) => {
  // Sign in. `exact: true` on Password matters: the field sits next to a
  // "Show password" toggle button, and a substring match resolves to both.
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("organiser@test.local");
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();

  // Landed on the organiser's events page.
  await page.waitForURL("**/events");
  await expect(
    page.getByRole("heading", { name: "My Events" }),
  ).toBeVisible();

  // Create a uniquely-named draft so the assertion can't collide with seed data.
  const draftName = `E2E Draft ${Date.now()}`;
  await page.getByRole("button", { name: /New draft/i }).first().click();
  await page.getByLabel("Event name").fill(draftName);
  await page.getByRole("button", { name: /Create draft/i }).click();

  // The new draft shows up in the table.
  await expect(page.getByRole("cell", { name: draftName })).toBeVisible();
});
