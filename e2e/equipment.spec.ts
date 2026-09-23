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

    await page.getByRole("button", { name: /Reserve.*equipment/ }).click();
    await expect(
      page.getByText(/Reservation confirmed\. \d+ unit\(s\) remain available\./),
    ).toBeVisible();
  });

  test("AC 3: requesting more than the pool is refused and the shortfall is shown", async ({ page }) => {
    await signInAsTechSupport(page);
    await fillReservation(page, "99");

    await expect(
      page.getByRole("status"),
      // SCRUM-29 — the live status now names the shortfall as well as what is
      // free, so this asserts both halves rather than just the refusal.
    ).toContainText(
      /Requested quantity \(99\) exceeds availability \(\d+ unit\(s\) available for this period\) — \d+ short\./,
    );

    await page.getByRole("button", { name: /Reserve.*equipment/ }).click();

    await expect(
      page.getByText(/Only \d+ of 4 unit\(s\) are available for this period — \d+ short\./),
    ).toBeVisible();
  });

  test("AC 6: a quantity of zero is refused", async ({ page }) => {
    await signInAsTechSupport(page);
    await fillReservation(page, "0");

    await expect(
      page.getByRole("status"),
    ).toContainText("Enter a quantity of at least 1.");

    await page.getByRole("button", { name: /Reserve.*equipment/ }).click();

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

    await page.getByRole("button", { name: /Reserve.*equipment/ }).click();

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
    await page.getByRole("button", { name: /Reserve.*equipment/ }).click();

    await expect(
      page.getByText("Please specify complete start and end dates and times."),
    ).toBeVisible();
    await expect(page.getByText("Choose both a start date and time.")).toBeVisible();
    await expect(page.getByText("Choose both an end date and time.")).toBeVisible();
  });
});

/**
 * SCRUM-30 — see what an item is already committed to, so conflicts are
 * visible before a reservation is attempted. The seed puts one speaker out of
 * service as DAMAGED and three projectors in for MAINTENANCE.
 */
test.describe("SCRUM-30 — View Equipment Conflicts", () => {
  test("AC 5: selecting an item shows its commitments with the reason and the period", async ({
    page,
  }) => {
    await signInAsTechSupport(page);
    await page.getByLabel("Equipment type").selectOption({ value: "eqp_speaker" });

    const schedule = page.getByTestId("equipment-schedule");
    await expect(schedule).toBeVisible();
    await expect(schedule).toContainText("Damaged");
    await expect(schedule).toContainText("Blown driver, awaiting write-off.");
    await expect(schedule.getByTestId("schedule-entry").first()).toContainText(
      "1 unit(s)",
    );
  });

  test("AC 1: the maintenance the pool is committed to is listed", async ({
    page,
  }) => {
    test.skip(!usesLocalDatabase, "reads seeded commitments; local database only");
    await signInAsTechSupport(page);
    await page
      .getByLabel("Equipment type")
      .selectOption({ value: "eqp_projector" });

    const schedule = page.getByTestId("equipment-schedule");
    await expect(schedule).toBeVisible();
    await expect(schedule).toContainText("Under maintenance");
    await expect(schedule.getByTestId("schedule-entry").first()).toBeVisible();
  });

  // The cases below need commitments of a known shape, so they use their own
  // throwaway equipment row rather than mutating seeded data: deleting the
  // seeded mic reservations would leave "Confirmed — Charity Gala" with no
  // equipment for every later run and for the sprint demo.
  const SPARE = "eqp_e2e_conflicts";

  async function spareEquipment(commitments: { from: number; to: number }[]) {
    await prisma.equipment.upsert({
      where: { id: SPARE },
      update: { isActive: true },
      create: {
        id: SPARE,
        type: "E2E Conflict Rig",
        totalQuantity: 4,
        isActive: true,
      },
    });
    await prisma.reservation.deleteMany({ where: { equipmentId: SPARE } });
    const day = new Date();
    day.setUTCDate(day.getUTCDate() + 40);
    for (const [index, slot] of commitments.entries()) {
      const startAt = new Date(day);
      startAt.setUTCHours(slot.from, 0, 0, 0);
      const endAt = new Date(day);
      endAt.setUTCHours(slot.to, 0, 0, 0);
      await prisma.reservation.create({
        data: {
          id: `${SPARE}_res_${index}`,
          eventId: "evt_approved",
          equipmentId: SPARE,
          quantity: 1,
          startAt,
          endAt,
          reservedById: "usr_techsupport",
          status: "CONFIRMED",
        },
      });
    }
  }

  async function removeSpareEquipment() {
    await prisma.reservation.deleteMany({ where: { equipmentId: SPARE } });
    await prisma.equipment.deleteMany({ where: { id: SPARE } });
  }

  test.afterEach(async () => {
    if (!usesLocalDatabase) return;
    await removeSpareEquipment();
  });

  test("AC 2 & 4: two reservations that share time are flagged as conflicting", async ({
    page,
  }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await spareEquipment([
      { from: 9, to: 13 },
      { from: 11, to: 15 },
    ]);

    await signInAsTechSupport(page);
    await page.getByLabel("Equipment type").selectOption({ value: SPARE });

    const schedule = page.getByTestId("equipment-schedule");
    await expect(schedule).toBeVisible();
    await expect(schedule.getByTestId("schedule-conflict-count")).toContainText(
      "2 overlapping",
    );
    await expect(
      schedule.locator('[data-testid="schedule-entry"][data-conflict="true"]'),
    ).toHaveCount(2);
    await expect(schedule).toContainText("Overlaps 1 other commitment(s)");
  });

  test("AC 3: back-to-back reservations are adjacent and are not flagged", async ({
    page,
  }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await spareEquipment([
      { from: 9, to: 13 },
      { from: 13, to: 17 },
    ]);

    await signInAsTechSupport(page);
    await page.getByLabel("Equipment type").selectOption({ value: SPARE });

    const schedule = page.getByTestId("equipment-schedule");
    await expect(schedule).toBeVisible();
    await expect(schedule.getByTestId("schedule-entry")).toHaveCount(2);
    await expect(
      schedule.locator('[data-testid="schedule-entry"][data-conflict="true"]'),
    ).toHaveCount(0);
    await expect(
      schedule.getByTestId("schedule-conflict-count"),
    ).toHaveCount(0);
  });

  // SCRUM-30 is meant to answer "what is this item committed to". A list that
  // omits the reservation you just made answers it wrongly at exactly the
  // moment someone looks.
  test("AC 1: a reservation made here appears in the commitments without a reload", async ({
    page,
  }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await spareEquipment([]);

    await signInAsTechSupport(page);
    await page
      .getByLabel("Approved event")
      .selectOption({ label: "Approved — Research Symposium" });
    await page.getByLabel("Start date").fill("2031-07-02");
    await page.getByLabel("Start time").fill("09:00");
    await page.getByLabel("End date").fill("2031-07-02");
    await page.getByLabel("End time").fill("17:00");
    await page.getByLabel("Equipment type").selectOption({ value: SPARE });
    await page.getByLabel("Quantity", { exact: true }).fill("1");

    await expect(page.getByTestId("schedule-fully-available")).toBeVisible();

    await page.getByRole("button", { name: /Reserve.*equipment/ }).click();
    await expect(
      page.getByText(/Reservation confirmed\. \d+ unit\(s\) remain available\./),
    ).toBeVisible();

    const schedule = page.getByTestId("equipment-schedule");
    await expect(schedule.getByTestId("schedule-entry")).toHaveCount(1);
    await expect(schedule).toContainText("Approved — Research Symposium");
  });

  test("AC 6: an item with nothing committed says so instead of showing an empty list", async ({
    page,
  }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await spareEquipment([]);

    await signInAsTechSupport(page);
    await page.getByLabel("Equipment type").selectOption({ value: SPARE });

    await expect(page.getByTestId("schedule-fully-available")).toContainText(
      "nothing is reserved or out of service",
    );
    await expect(page.getByTestId("schedule-entry")).toHaveCount(0);
  });
});
