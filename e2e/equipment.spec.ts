import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

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
  await page.locator('[data-hydrated="true"]').waitFor();
}

async function fillReservation(page: Page, quantity: string) {
  await page
    .getByLabel("Approved event")
    .selectOption({ label: "Approved — Research Symposium" });
  await page.getByLabel("Start date").fill("2031-05-10");
  await page.getByLabel("Start time").fill("09:00");
  await page.getByLabel("End date").fill("2031-05-10");
  await page.getByLabel("End time").fill("17:00");
  await page.getByLabel("Equipment type").selectOption({ value: "eqp_lectern" });
  await page.getByLabel("Quantity", { exact: true }).fill(quantity);
}

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

test.describe("SCRUM-31 — Reserve Equipment for Event", () => {
  test.beforeEach(async () => {
    if (!usesLocalDatabase) return;
    await prisma.reservation.deleteMany({
      where: {
        eventId: "evt_approved",
        startAt: { gte: new Date("2031-01-01T00:00:00.000Z") },
      },
    });
  });

  test("AC 1 & 7: a reservation that fits is confirmed and reduces availability", async ({ page }) => {
    await signInAsTechSupport(page);
    await fillReservation(page, "1");

    await expect(
      page.getByRole("status").filter({ hasText: "unit(s) available" }),
    ).toContainText(/\d+ unit\(s\) available for this period/);
    await expect(page.locator("span", { hasText: /\d+ of 4 available/ })).toBeVisible();

    await page.getByRole("button", { name: /Reserve .* equipment/ }).click();
    await expect(
      page.getByText(/Reservation confirmed\. \d+ unit\(s\) remain available\./),
    ).toBeVisible();
  });

  test("AC 3: requesting more than the pool is refused and the shortfall is shown", async ({ page }) => {
    await signInAsTechSupport(page);
    await fillReservation(page, "99");

    await expect(
      page.getByRole("status"),
    ).toContainText(/Requested quantity \(99\) exceeds availability \(\d+ unit\(s\) available for this period\)\./);

    await page.getByRole("button", { name: /Reserve .* equipment/ }).click();

    await expect(
      page.getByText(/Only \d+ of 4 unit\(s\) are available for this period — \d+ short\./),
    ).toBeVisible();
  });

  test("AC 6: a quantity of zero is refused", async ({ page }) => {
    await signInAsTechSupport(page);
    await fillReservation(page, "0");

    await page.getByRole("button", { name: /Reserve .* equipment/ }).click();

    await expect(page.getByText("Please fix the reservation details.")).toBeVisible();
    await expect(page.getByText("Quantity must be greater than zero.")).toBeVisible();
  });

  test("AC 4: an invalid period (end earlier than start) triggers live inline error", async ({ page }) => {
    await signInAsTechSupport(page);
    await page.getByLabel("Start date").fill("2031-05-10");
    await page.getByLabel("Start time").fill("17:00");
    await page.getByLabel("End date").fill("2031-05-10");
    await page.getByLabel("End time").fill("09:00");

    await expect(
      page.getByText("End time must be after the start time.").first(),
    ).toBeVisible();
  });

  test("AC: a start time in the past triggers live inline error and prevents reservation", async ({ page }) => {
    await signInAsTechSupport(page);
    await page
      .getByLabel("Approved event")
      .selectOption({ label: "Approved — Research Symposium" });
    await page.getByLabel("Equipment type").selectOption({ value: "eqp_lectern" });
    await page.getByLabel("Start date").fill("2020-01-01");
    await page.getByLabel("Start time").fill("09:00");
    await page.getByLabel("End date").fill("2020-01-01");
    await page.getByLabel("End time").fill("17:00");

    await expect(
      page.getByText("Start time cannot be in the past.").first(),
    ).toBeVisible();

    await page.getByRole("button", { name: /Reserve .* equipment/ }).click();

    await expect(
      page.getByText("Start time cannot be in the past.").first(),
    ).toBeVisible();
    await expect(page.getByText(/Reservation confirmed/)).not.toBeVisible();
  });

  test("AC: incomplete date or time prevents reservation and displays validation error", async ({ page }) => {
    await signInAsTechSupport(page);
    await page
      .getByLabel("Approved event")
      .selectOption({ label: "Approved — Research Symposium" });
    await page.getByLabel("Equipment type").selectOption({ value: "eqp_lectern" });
    await page.getByLabel("Start time").fill("09:00");
    await page.getByRole("button", { name: /Reserve .* equipment/ }).click();

    await expect(
      page.getByText("Please specify complete start and end dates and times."),
    ).toBeVisible();
    await expect(page.getByText("Choose both a start date and time.")).toBeVisible();
    await expect(page.getByText("Choose both an end date and time.")).toBeVisible();
  });
});
