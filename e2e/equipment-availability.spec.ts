import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";
import { pickDateTime, selectFrom } from "./helpers";

/**
 * SCRUM-29 — Check Equipment Availability. Technical Support enters a type, a
 * period and a quantity, and the page states what is free for the whole of
 * that period: the busiest instant of the pool, with reservations and
 * maintenance weighed together, touching periods treated as adjacent, and the
 * shortfall stated when the quantity does not fit. Since SCRUM-156 the form
 * only checks: reserving is through an approved request, tested in
 * request-reservation.spec.ts.
 */
async function signInAsTechSupport(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("techsupport@test.local");
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.goto("/equipment");
  await expect(page.getByText("Equipment availability", { exact: true })).toBeVisible();
  await page.locator('[data-hydrated="true"]').waitFor();
}

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

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
const rigId = () => `eqp_e2e_avail_w${test.info().workerIndex}`;
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

/** Fill the availability check for the rig over [from, to) on RIG_DAY. */
async function fillRigPeriod(page: Page, from: number, to: number, quantity: string) {
  await pickDateTime(page.getByLabel("Start", { exact: true }), `${RIG_DAY}T${sgTime(from)}`);
  await pickDateTime(page.getByLabel("End", { exact: true }), `${RIG_DAY}T${sgTime(to)}`);
  await selectFrom(page.getByLabel("Equipment type"), { value: rigId() });
  await page.getByLabel("Quantity", { exact: true }).fill(quantity);
}

const liveStatus = (page: Page) =>
  page.getByRole("status").filter({ hasText: "unit(s) available" });

test.describe("SCRUM-29 — Check Equipment Availability", () => {
  test.afterEach(async () => {
    if (usesLocalDatabase) await removeRig();
  });

  // Two reservations of three that never share an instant commit three units,
  // not six. Before the fix the page summed them and showed 0 of 4.
  test("SCRUM-29 [AC1] TC-29-01: shows the free quantity for the period, from the busiest instant", async ({
    page,
  }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await buildRig({
      reservations: [
        { from: 9, to: 12, quantity: 3 },
        { from: 13, to: 16, quantity: 3 },
      ],
    });

    await signInAsTechSupport(page);
    await fillRigPeriod(page, 9, 16, "1");

    await expect(page.getByTestId("selected-availability")).toHaveText("1 of 4 available");
  });

  test("SCRUM-29 [AC2] TC-29-02: a quantity that fits is reported available", async ({
    page,
  }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await buildRig({
      reservations: [
        { from: 9, to: 12, quantity: 3 },
        { from: 13, to: 16, quantity: 3 },
      ],
    });

    await signInAsTechSupport(page);
    await fillRigPeriod(page, 9, 16, "1");

    await expect(liveStatus(page)).toHaveText(
      "Your requested quantity is available (1 unit(s) available for this period).",
    );
  });

  test("SCRUM-29 [AC3] TC-29-03: a quantity over the free units reports the shortfall", async ({
    page,
  }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await buildRig({ reservations: [{ from: 9, to: 12, quantity: 3 }] });

    await signInAsTechSupport(page);
    await fillRigPeriod(page, 9, 12, "3");

    await expect(liveStatus(page)).toHaveText(
      "Requested quantity (3) exceeds availability (1 unit(s) available for this period) — 2 short.",
    );
  });

  test("SCRUM-29 [AC4] TC-29-01: equipment reserved for an overlapping period is excluded", async ({
    page,
  }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await buildRig({ reservations: [{ from: 10, to: 11, quantity: 4 }] });

    await signInAsTechSupport(page);
    await fillRigPeriod(page, 9, 12, "1");

    await expect(page.getByTestId("selected-availability")).toHaveText("0 of 4 available");
  });

  test("SCRUM-29 [AC5] TC-29-04: a reservation that ends exactly when the period begins leaves the pool free", async ({
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
  });

  test("SCRUM-29 [AC6] TC-29-05: units under maintenance or damaged are not shown as available", async ({
    page,
  }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await buildRig({
      outages: [
        { from: 8, to: 18, quantity: 1, reason: "MAINTENANCE" },
        { from: 10, to: 11, quantity: 1, reason: "DAMAGED" },
      ],
    });

    await signInAsTechSupport(page);
    await fillRigPeriod(page, 9, 12, "1");

    await expect(page.getByTestId("selected-availability")).toHaveText("2 of 4 available");
  });

  test("SCRUM-29 [AC7] TC-29-06: a zero quantity or an end before the start is rejected with no result", async ({
    page,
  }) => {
    test.skip(!usesLocalDatabase, "writes its own equipment; local database only");
    await buildRig();

    await signInAsTechSupport(page);
    await fillRigPeriod(page, 9, 12, "0");
    await expect(page.getByText("Enter a quantity of at least 1.")).toBeVisible();

    await page.getByLabel("Quantity", { exact: true }).fill("1");
    await pickDateTime(page.getByLabel("End", { exact: true }), `${RIG_DAY}T${sgTime(8)}`);
    await expect(page.getByText("End time must be after the start time.").first()).toBeVisible();
    await expect(page.getByTestId("selected-availability")).toHaveText("— of 4 available");
  });
});
