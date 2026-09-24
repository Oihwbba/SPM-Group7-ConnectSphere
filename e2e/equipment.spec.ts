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
 * SCRUM-29 and SCRUM-30 need commitments of a known shape, so they build a
 * throwaway equipment row (the "rig") instead of mutating seeded data:
 * deleting seeded reservations would leave "Confirmed — Charity Gala" with no
 * equipment for every later run and for the sprint demo.
 *
 * Times are Singapore wall time, because that is what the form takes and
 * converts to UTC — a fixture written in UTC would sit eight hours off the
 * period the test types in. The rig id carries the worker index: Playwright
 * runs tests in parallel locally, and two tests sharing one rig would see each
 * other's reservations.
 */
const RIG_DAY = "2032-08-18";
const RIG_TOTAL = 4;
const rigId = () => `eqp_e2e_sched_w${test.info().workerIndex}`;
const sgTime = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
const sgInstant = (hour: number) => new Date(`${RIG_DAY}T${sgTime(hour)}:00+08:00`);

type Slot = { from: number; to: number; quantity: number };
type Outage = Slot & { reason: "MAINTENANCE" | "DAMAGED"; note?: string };

async function removeRig() {
  const id = rigId();
  await prisma.reservation.deleteMany({ where: { equipmentId: id } });
  await prisma.equipmentUnavailability.deleteMany({ where: { equipmentId: id } });
  await prisma.equipment.deleteMany({ where: { id } });
}

async function buildRig({
  reservations = [],
  outages = [],
}: { reservations?: Slot[]; outages?: Outage[] } = {}) {
  const id = rigId();
  await removeRig();
  await prisma.equipment.create({
    data: { id, type: `E2E Rig ${id}`, totalQuantity: RIG_TOTAL, isActive: true },
  });
  for (const slot of reservations) {
    await prisma.reservation.create({
      data: {
        eventId: "evt_approved",
        equipmentId: id,
        quantity: slot.quantity,
        startAt: sgInstant(slot.from),
        endAt: sgInstant(slot.to),
        reservedById: "usr_techsupport",
        status: "CONFIRMED",
      },
    });
  }
  for (const outage of outages) {
    await prisma.equipmentUnavailability.create({
      data: {
        equipmentId: id,
        quantity: outage.quantity,
        startAt: sgInstant(outage.from),
        endAt: sgInstant(outage.to),
        reason: outage.reason,
        note: outage.note ?? null,
        recordedById: "usr_techsupport",
      },
    });
  }
}

/** Fill the reservation form for the rig over [from, to) on RIG_DAY. */
async function fillRigPeriod(page: Page, from: number, to: number, quantity: string) {
  await page
    .getByLabel("Approved event")
    .selectOption({ label: "Approved — Research Symposium" });
  await page.getByLabel("Start date").fill(RIG_DAY);
  await page.getByLabel("Start time").fill(sgTime(from));
  await page.getByLabel("End date").fill(RIG_DAY);
  await page.getByLabel("End time").fill(sgTime(to));
  await page.getByLabel("Equipment type").selectOption({ value: rigId() });
  await page.getByLabel("Quantity", { exact: true }).fill(quantity);
}

/**
 * SCRUM-30 — see what an item is already committed to, so conflicts are
 * visible before a reservation is attempted. The seed puts one speaker out of
 * service as DAMAGED and three projectors in for MAINTENANCE.
 */
test.describe("SCRUM-30 — View Equipment Conflicts", () => {
  test.afterEach(async () => {
    if (usesLocalDatabase) await removeRig();
  });

  test("AC 5: selecting a seeded item shows its commitments with the reason", async ({
    page,
  }) => {
    await signInAsTechSupport(page);
    await page.getByLabel("Equipment type").selectOption({ value: "eqp_speaker" });

    const schedule = page.getByTestId("equipment-schedule");
    await expect(schedule).toBeVisible();
    await expect(schedule).toContainText("Damaged");
    await expect(schedule).toContainText("Blown driver, awaiting write-off.");
    await expect(schedule.getByTestId("schedule-entry").first()).toContainText("1 unit(s)");
  });

  test("AC 1: the seeded maintenance on the projector pool is listed", async ({ page }) => {
    test.skip(!usesLocalDatabase, "reads seeded commitments; local database only");
    await signInAsTechSupport(page);
    await page.getByLabel("Equipment type").selectOption({ value: "eqp_projector" });

    const schedule = page.getByTestId("equipment-schedule");
    await expect(schedule).toBeVisible();
    await expect(schedule).toContainText("Under maintenance");
  });

  test("AC 1: lists each reservation with the event it serves", async ({ page }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await buildRig({
      reservations: [
        { from: 9, to: 11, quantity: 1 },
        { from: 14, to: 16, quantity: 2 },
      ],
    });

    await signInAsTechSupport(page);
    await page.getByLabel("Equipment type").selectOption({ value: rigId() });

    const entries = page.getByTestId("schedule-entry");
    await expect(entries).toHaveCount(2);
    await expect(entries.first()).toContainText("Approved — Research Symposium");
    await expect(entries.first()).toContainText("1 unit(s)");
    await expect(entries.nth(1)).toContainText("2 unit(s)");
  });

  test("AC 2: reservations that share time are highlighted and counted", async ({ page }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await buildRig({
      reservations: [
        { from: 9, to: 13, quantity: 1 },
        { from: 11, to: 15, quantity: 1 },
      ],
    });

    await signInAsTechSupport(page);
    await page.getByLabel("Equipment type").selectOption({ value: rigId() });

    const schedule = page.getByTestId("equipment-schedule");
    await expect(schedule.getByTestId("schedule-conflict-count")).toHaveText("2 overlapping");
    await expect(
      schedule.locator('[data-testid="schedule-entry"][data-conflict="true"]'),
    ).toHaveCount(2);
    await expect(schedule).toContainText("Overlaps 1 other commitment(s); 2 of 4 unit(s) in use.");
  });

  test("AC 3: back-to-back reservations are adjacent and are not flagged", async ({ page }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await buildRig({
      reservations: [
        { from: 9, to: 13, quantity: 1 },
        { from: 13, to: 17, quantity: 1 },
      ],
    });

    await signInAsTechSupport(page);
    await page.getByLabel("Equipment type").selectOption({ value: rigId() });

    const schedule = page.getByTestId("equipment-schedule");
    await expect(schedule.getByTestId("schedule-entry")).toHaveCount(2);
    await expect(
      schedule.locator('[data-testid="schedule-entry"][data-conflict="true"]'),
    ).toHaveCount(0);
    await expect(schedule.getByTestId("schedule-conflict-count")).toHaveCount(0);
  });

  // Written straight to the table: the reservation action refuses this, but
  // only the action enforces the pool, so the view must say so when the
  // stored commitments exceed it.
  test("AC 4: commitments that exceed the pool are flagged as a hard conflict", async ({
    page,
  }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await buildRig({
      reservations: [
        { from: 9, to: 12, quantity: 3 },
        { from: 10, to: 13, quantity: 3 },
      ],
    });

    await signInAsTechSupport(page);
    await page.getByLabel("Equipment type").selectOption({ value: rigId() });

    await expect(page.getByTestId("equipment-schedule")).toContainText(
      "Hard conflict — 6 unit(s) committed of 4.",
    );
  });

  test("AC 5: an outage shows its reason, note and period", async ({ page }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await buildRig({
      outages: [{ from: 9, to: 17, quantity: 2, reason: "MAINTENANCE", note: "Annual service" }],
    });

    await signInAsTechSupport(page);
    await page.getByLabel("Equipment type").selectOption({ value: rigId() });

    const entry = page.getByTestId("schedule-entry");
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText("Under maintenance");
    await expect(entry).toContainText("Annual service");
    await expect(entry).toContainText("2 unit(s)");
    await expect(entry).toContainText("18 Aug 2032");
  });

  // SCRUM-30 is meant to answer "what is this item committed to". A list that
  // omits the reservation you just made answers it wrongly at exactly the
  // moment someone looks.
  test("AC 1: a reservation made here appears in the commitments without a reload", async ({
    page,
  }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await buildRig();

    await signInAsTechSupport(page);
    await fillRigPeriod(page, 9, 17, "1");
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
    await buildRig();

    await signInAsTechSupport(page);
    await page.getByLabel("Equipment type").selectOption({ value: rigId() });

    await expect(page.getByTestId("schedule-fully-available")).toContainText(
      "nothing is reserved or out of service",
    );
    await expect(page.getByTestId("schedule-entry")).toHaveCount(0);
  });

  // The panel must degrade inline rather than take the page down: the
  // reservation form stays usable when the schedule cannot be read.
  test("shows the schedule's own error when the item can no longer be read, and keeps the form", async ({
    page,
  }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await buildRig();

    await signInAsTechSupport(page);
    await prisma.equipment.update({ where: { id: rigId() }, data: { isActive: false } });
    await page.getByLabel("Equipment type").selectOption({ value: rigId() });

    await expect(page.getByTestId("schedule-error")).toHaveText("Equipment type is unavailable.");
    await expect(page.getByRole("button", { name: /Reserve.*equipment/ })).toBeVisible();
  });
});
