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
 * SCRUM-30 — see what an item is already committed to, split by the period
 * being requested. Commitments that share time with it sit under the selected
 * item's availability, amber while the request fits and red with the
 * shortfall once it does not. Everything else sits below the other equipment,
 * neutral. The seed puts one speaker out of service as DAMAGED and three
 * projectors in for MAINTENANCE.
 */
test.describe("SCRUM-30 — View Equipment Conflicts", () => {
  test.afterEach(async () => {
    if (usesLocalDatabase) await removeRig();
  });

  const during = (page: Page) => page.getByTestId("commitments-during");
  const other = (page: Page) => page.getByTestId("commitments-other");

  test("AC 5: selecting a seeded item shows its commitments with the reason", async ({
    page,
  }) => {
    await signInAsTechSupport(page);
    await page.getByLabel("Equipment type").selectOption({ value: "eqp_speaker" });

    // No period yet, so nothing can be "during" it: everything is an other commitment.
    await expect(page.getByTestId("during-no-period")).toBeVisible();
    await expect(other(page)).toContainText("Damaged");
    await expect(other(page)).toContainText("Blown driver, awaiting write-off.");
    await expect(other(page).getByTestId("schedule-entry").first()).toContainText("1 unit(s)");
  });

  test("AC 1: the seeded maintenance on the projector pool is listed", async ({ page }) => {
    test.skip(!usesLocalDatabase, "reads seeded commitments; local database only");
    await signInAsTechSupport(page);
    await page.getByLabel("Equipment type").selectOption({ value: "eqp_projector" });

    await expect(other(page)).toBeVisible();
    await expect(other(page)).toContainText("Under maintenance");
    await expect(other(page).getByTestId("schedule-entry").first()).toBeVisible();
  });

  test("AC 1 & 8: commitments overlapping the requested period are listed under it, the rest under other commitments", async ({
    page,
  }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await buildRig({
      reservations: [
        { from: 9, to: 11, quantity: 1 },
        { from: 13, to: 14, quantity: 2 },
        { from: 16, to: 18, quantity: 1 },
      ],
    });

    await signInAsTechSupport(page);
    await fillRigPeriod(page, 12, 15, "1");

    await expect(during(page).getByTestId("schedule-entry")).toHaveCount(1);
    await expect(during(page).getByTestId("schedule-entry")).toContainText(
      "Approved — Research Symposium",
    );
    await expect(during(page).getByTestId("schedule-entry")).toContainText("2 unit(s)");
    await expect(other(page).getByTestId("schedule-entry")).toHaveCount(2);
  });

  test("the requested-period section sits under the selected item, and other commitments below the other equipment", async ({
    page,
  }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await buildRig({ reservations: [{ from: 16, to: 18, quantity: 1 }] });

    await signInAsTechSupport(page);
    await fillRigPeriod(page, 12, 15, "1");

    const top = async (locator: ReturnType<Page["getByTestId"]>) =>
      (await locator.boundingBox())!.y;
    await expect(other(page)).toBeVisible();
    const selectedCount = await top(page.getByTestId("selected-availability"));
    const duringTop = await top(during(page));
    const otherEquipmentTop = (await page
      .getByText("Other equipment (for the same period)")
      .boundingBox())!.y;
    const otherTop = await top(other(page));

    expect(selectedCount).toBeLessThan(duringTop);
    expect(duringTop).toBeLessThan(otherEquipmentTop);
    expect(otherEquipmentTop).toBeLessThan(otherTop);
  });

  test("AC 2: commitments during the period are amber while the requested quantity can still be fulfilled", async ({
    page,
  }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await buildRig({ reservations: [{ from: 13, to: 14, quantity: 2 }] });

    await signInAsTechSupport(page);
    // Exactly the free quantity: the boundary is still amber.
    await fillRigPeriod(page, 12, 15, "2");

    await expect(page.getByTestId("selected-availability")).toHaveText("2 of 4 available");
    await expect(during(page).getByTestId("schedule-entry")).toHaveAttribute("data-tone", "amber");
    await expect(page.getByTestId("during-summary")).toHaveAttribute("data-tone", "amber");
    await expect(page.getByTestId("during-summary")).toHaveText(
      "These commitments leave 2 of 4 unit(s) free — your request for 2 fits.",
    );
  });

  test("AC 4 & 7: they turn red with the shortfall only when the requested quantity exceeds what is free", async ({
    page,
  }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await buildRig({ reservations: [{ from: 13, to: 14, quantity: 2 }] });

    await signInAsTechSupport(page);
    await fillRigPeriod(page, 12, 15, "3");

    await expect(during(page).getByTestId("schedule-entry")).toHaveAttribute("data-tone", "red");
    await expect(page.getByTestId("during-summary")).toHaveAttribute("data-tone", "red");
    await expect(page.getByTestId("during-summary")).toHaveText(
      "Hard conflict — 3 requested but only 2 of 4 unit(s) are free for this period: 1 short.",
    );

    // Bringing the request back within what is free takes the red away.
    await page.getByLabel("Quantity", { exact: true }).fill("2");
    await expect(during(page).getByTestId("schedule-entry")).toHaveAttribute("data-tone", "amber");
  });

  test("AC 3 & 9: commitments that only touch the period are other commitments and leave it fully available", async ({
    page,
  }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await buildRig({
      reservations: [
        { from: 9, to: 12, quantity: 4 },
        { from: 15, to: 18, quantity: 4 },
      ],
    });

    await signInAsTechSupport(page);
    await fillRigPeriod(page, 12, 15, "4");

    await expect(page.getByTestId("selected-availability")).toHaveText("4 of 4 available");
    await expect(page.getByTestId("during-fully-available")).toContainText(
      "Nothing is committed during this period — all 4 unit(s) are free.",
    );
    await expect(other(page).getByTestId("schedule-entry")).toHaveCount(2);
  });

  // Two reservations outside the period that together exceed the pool: they
  // do not affect this request, so they stay neutral.
  test("other commitments stay neutral even when they overlap each other", async ({ page }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await buildRig({
      reservations: [
        { from: 16, to: 19, quantity: 3 },
        { from: 17, to: 20, quantity: 3 },
      ],
    });

    await signInAsTechSupport(page);
    await fillRigPeriod(page, 12, 15, "1");

    const rows = other(page).getByTestId("schedule-entry");
    await expect(rows).toHaveCount(2);
    await expect(other(page).locator('[data-tone="neutral"]')).toHaveCount(2);
    await expect(page.locator('[data-tone="red"], [data-tone="amber"]')).toHaveCount(0);
  });

  test("AC 5: an outage shows its reason, note and period", async ({ page }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await buildRig({
      outages: [{ from: 9, to: 17, quantity: 2, reason: "MAINTENANCE", note: "Annual service" }],
    });

    await signInAsTechSupport(page);
    await fillRigPeriod(page, 12, 15, "1");

    const entry = during(page).getByTestId("schedule-entry");
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText("Under maintenance");
    await expect(entry).toContainText("Annual service");
    await expect(entry).toContainText("2 unit(s)");
    await expect(entry).toContainText("18 Aug 2032, 9:00 am");
    await expect(entry).toContainText("18 Aug 2032, 5:00 pm");
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
    await expect(page.getByTestId("during-fully-available")).toBeVisible();

    await page.getByRole("button", { name: /Reserve.*equipment/ }).click();
    await expect(
      page.getByText(/Reservation confirmed\. \d+ unit\(s\) remain available\./),
    ).toBeVisible();

    await expect(during(page).getByTestId("schedule-entry")).toHaveCount(1);
    await expect(during(page)).toContainText("Approved — Research Symposium");
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

    await fillRigPeriod(page, 12, 15, "1");
    await expect(page.getByTestId("during-fully-available")).toBeVisible();
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
    await expect(other(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Reserve.*equipment/ })).toBeVisible();
  });
});
