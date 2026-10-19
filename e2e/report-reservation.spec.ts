import { test, expect } from "@playwright/test";

import { prisma } from "@/lib/db";
import { signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-32 — Technical Support report, from the Equipment page, that reserved
 * equipment can no longer be provided; the Coordinator then finds the
 * reservation flagged with that reason on the event (SCRUM-26). The rules are
 * in tests/unit/report-reservation.test.ts and
 * tests/integration/report-reservation.test.ts. Test cases:
 * docs/testing/SCRUM-32.md.
 *
 * Its event, equipment type and reservation are its own, made in the
 * database and removed afterwards with the notices about them.
 */
const STAMP = Date.now();
const EVENT = `SCRUM-32 E2E ${STAMP}`;
const RIG = `SCRUM-32 E2E rig ${STAMP}`;
const REASON = "The rig's power supply failed its test.";

test.describe("SCRUM-32 — report reserved equipment that can no longer be provided", () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(!usesLocalDatabase, "writes its own event and equipment; local database only");

  let eventId: string;
  let equipmentId: string;

  test.beforeAll(async () => {
    if (!usesLocalDatabase) return;
    const startAt = new Date("2036-10-05T01:00:00.000Z");
    const endAt = new Date("2036-10-05T05:00:00.000Z");
    eventId = (
      await prisma.event.create({
        data: {
          name: EVENT,
          status: "PLANNING",
          organiserId: "usr_organiser",
          coordinatorId: "usr_coordinator",
          startAt,
          endAt,
          expectedAttendance: 40,
        },
        select: { id: true },
      })
    ).id;
    equipmentId = (
      await prisma.equipment.create({
        data: { type: RIG, totalQuantity: 4 },
        select: { id: true },
      })
    ).id;
    await prisma.reservation.create({
      data: { eventId, equipmentId, quantity: 2, startAt, endAt, reservedById: "usr_techsupport" },
    });
  });

  test.afterAll(async () => {
    if (!usesLocalDatabase) return;
    const reservations = await prisma.reservation.findMany({
      where: { eventId },
      select: { id: true },
    });
    await prisma.notification.deleteMany({ where: { eventId } });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: reservations.map((r) => r.id) } },
    });
    await prisma.reservation.deleteMany({ where: { eventId } });
    await prisma.equipment.delete({ where: { id: equipmentId } });
    await prisma.event.delete({ where: { id: eventId } });
  });

  test("SCRUM-32 [AC1, AC2, AC4] TC-32-01, TC-32-02: Technical Support report a reservation with a reason, and the Coordinator finds it flagged with that reason", async ({
    browser,
  }) => {
    const tech = await signedIn(browser, "techsupport@test.local");
    await tech.goto("/equipment");
    await tech.locator('[data-hydrated="true"]').waitFor();
    await tech.getByLabel("Equipment type").selectOption({ value: equipmentId });

    const row = tech
      .getByTestId("commitments-other")
      .getByTestId("schedule-entry")
      .filter({ hasText: EVENT });
    await expect(row).toContainText("2 unit(s)");
    await row.getByRole("button", { name: "Can't provide this" }).click();

    // AC2: no report without a reason.
    const send = row.getByRole("button", { name: "Report", exact: true });
    await expect(send).toBeDisabled();
    await row.getByLabel("Why can't it be provided?").fill("   ");
    await expect(send).toBeDisabled();

    await row.getByLabel("Why can't it be provided?").fill(REASON);
    await send.click();
    await expect(tech.getByText("Reported. The event's Coordinator has been told.")).toBeVisible();
    // AC1, AC4: still reserved, now marked as reported, and not reportable again.
    await expect(row.getByTestId("reported-reservation")).toBeVisible();
    await expect(row).toContainText("2 unit(s)");
    await expect(row.getByRole("button", { name: "Can't provide this" })).toHaveCount(0);

    // AC2: the Coordinator reads the reason on the event, where they resolve it.
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator
      .getByRole("row", { name: new RegExp(EVENT) })
      .getByTestId("view-details-button")
      .click();
    const panel = coordinator.getByRole("dialog").getByTestId("reconsideration-panel");
    await expect(panel).toContainText(`${RIG} × 2`);
    await expect(panel).toContainText(REASON);
  });
});
