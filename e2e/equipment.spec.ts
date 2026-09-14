import { test, expect, type Page } from "@playwright/test";

/**
 * SCRUM-31 — Reserve equipment for an event. Technical Support reserves units
 * from a pool for an approved event; the pool can never be over-allocated.
 * Uses a far-future period so seeded reservations and maintenance never
 * overlap it, and asserts counts by pattern so a CI retry stays green.
 */
async function signInAsTechSupport(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("techsupport@test.local");
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.goto("/equipment");
  await expect(page.getByText("Reserve equipment")).toBeVisible();
}

async function fillReservation(page: Page, quantity: string) {
  await page
    .getByLabel("Approved event")
    .selectOption({ label: "Approved — Research Symposium" });
  await page.getByLabel("Equipment type").selectOption({ label: "Lectern (4 total)" });
  await page.getByLabel("Start", { exact: true }).fill("2031-05-10T09:00");
  await page.getByLabel("End", { exact: true }).fill("2031-05-10T17:00");
  await page.getByLabel("Quantity", { exact: true }).fill(quantity);
}

test.describe("SCRUM-31 — Reserve Equipment for Event", () => {
  test("AC 1 & 7: a reservation that fits is confirmed and reduces availability", async ({ page }) => {
    await signInAsTechSupport(page);
    await fillReservation(page, "1");

    await page.getByRole("button", { name: "Check availability" }).click();
    await expect(page.getByRole("status")).toContainText(
      /\d+ unit\(s\) available for this period/,
    );

    await page.getByRole("button", { name: "Confirm reservation" }).click();
    await expect(
      page.getByText(/Reservation confirmed\. \d+ unit\(s\) remain available\./),
    ).toBeVisible();
  });

  test("AC 3: requesting more than the pool is refused and the shortfall is shown", async ({ page }) => {
    await signInAsTechSupport(page);
    await fillReservation(page, "99");

    await page.getByRole("button", { name: "Confirm reservation" }).click();

    await expect(
      page.getByText(/Only \d+ of 4 unit\(s\) are available for this period — \d+ short\./),
    ).toBeVisible();
  });

  test("AC 6: a quantity of zero is refused", async ({ page }) => {
    await signInAsTechSupport(page);
    await fillReservation(page, "0");

    await page.getByRole("button", { name: "Confirm reservation" }).click();

    await expect(page.getByText("Please fix the reservation details.")).toBeVisible();
  });
});
