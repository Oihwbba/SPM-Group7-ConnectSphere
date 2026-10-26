import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { usesLocalDatabase, openEvent } from "./helpers";

/**
 * SCRUM-81 — the assigned Coordinator confirms a Planning event once its
 * SCRUM-110 checklist is complete, and the Organiser then sees what was
 * secured. Each test owns its events (created straight in the database), and
 * like the other writing specs it only runs against a localhost database.
 * Test cases: docs/testing/SCRUM-81.md.
 */

const PERIOD = {
  startAt: new Date("2031-07-01T01:00:00Z"),
  endAt: new Date("2031-07-01T09:00:00Z"),
};

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/events");
}

/** SCRUM-208: the event's page, on the tab this journey works in. */
async function openDetails(page: Page, eventName: string, tab = "Arrangements") {
  return openEvent(page, eventName, tab);
}

async function planningEvent(name: string) {
  const event = await prisma.event.create({
    data: {
      name,
      purpose: "Confirmation journey",
      description: "Owned by the SCRUM-81 e2e spec.",
      status: "PLANNING",
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      ...PERIOD,
      expectedAttendance: 55,
      venueRequirements: "Any room",
      requiredFacilities: [],
      accessibilityNeeds: "None",
      preferredLayout: "Classroom",
      equipmentRequirements: "Projectors",
      registrationNotes: "None",
      submittedAt: new Date(),
    },
    select: { id: true },
  });
  return event.id;
}

test.describe("SCRUM-81 — Move an approved event through planning to confirmed", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  const eventIds: string[] = [];

  test.afterEach(async () => {
    await prisma.reservation.deleteMany({
      where: { eventId: { in: eventIds } },
    });
    await prisma.booking.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.notification.deleteMany({
      where: { eventId: { in: eventIds } },
    });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    eventIds.length = 0;
  });

  test("SCRUM-81 [AC3, AC5, AC6, AC7] TC-81-02, TC-81-05, TC-81-06, TC-81-08: the assigned Coordinator confirms a ready event, and the Organiser then sees its confirmed venue, date and equipment", async ({
    page,
  }) => {
    const name = `SCRUM-81 Ready ${Date.now()}`;
    const eventId = await planningEvent(name);
    eventIds.push(eventId);
    await prisma.booking.create({
      data: {
        eventId,
        venueId: "ven_hall",
        ...PERIOD,
        status: "APPROVED",
        requestedById: "usr_coordinator",
        decidedById: "usr_venuestaff",
        decidedAt: new Date(),
      },
    });
    await prisma.equipmentRequest.create({
      data: {
        eventId,
        requestedById: "usr_coordinator",
        status: "APPROVED",
        lines: { create: [{ equipmentId: "eqp_projector", quantity: 2 }] },
      },
    });
    await prisma.reservation.create({
      data: {
        eventId,
        equipmentId: "eqp_projector",
        quantity: 2,
        ...PERIOD,
        status: "CONFIRMED",
        reservedById: "usr_techsupport",
      },
    });
    // SCRUM-166 AC9: confirming also needs an approved safety check.
    await prisma.safetyCheck.create({
      data: {
        eventId,
        status: "APPROVED",
        requestedById: "usr_coordinator",
        decidedById: "usr_safetyofficer",
        decidedAt: new Date(),
      },
    });

    // The Organiser sees the event is ready, but is not offered Confirm (AC 7).
    await signIn(page, "organiser@test.local");
    let dialog = await openDetails(page, name);
    await expect(dialog.getByTestId("readiness-summary")).toHaveText(
      "Ready to confirm",
    );
    await expect(
      dialog.getByRole("button", { name: "Confirm event" }),
    ).toHaveCount(0);

    // The assigned Coordinator confirms it (AC 3, AC 5).
    await signIn(page, "coordinator@test.local");
    dialog = await openDetails(page, name);
    const confirm = dialog.getByRole("button", { name: "Confirm event" });
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.getByText("Event confirmed.")).toBeVisible();
    await expect(dialog.getByTestId("status-badge")).toHaveAttribute(
      "data-status",
      "CONFIRMED",
    );
    await expect(dialog.getByTestId("readiness-checklist")).toHaveCount(0);

    // The confirmation is recorded once, by that Coordinator, and
    // registration is now open to Attendees (AC 5).
    expect(
      await prisma.auditLog.findMany({
        where: { entityId: eventId, newValue: "CONFIRMED" },
        select: { actorId: true },
      }),
    ).toEqual([{ actorId: "usr_coordinator" }]);
    expect(
      await prisma.event.findUnique({
        where: { id: eventId },
        select: { registrationEnabled: true },
      }),
    ).toEqual({ registrationEnabled: true });

    // The Organiser now sees what was secured (AC 6).
    await signIn(page, "organiser@test.local");
    dialog = await openDetails(page, name);
    const arrangements = dialog.getByTestId("confirmed-arrangements");
    await expect(arrangements).toBeVisible();
    await expect(arrangements.getByTestId("confirmed-venue")).toContainText(
      "Exhibition Hall",
    );
    await expect(arrangements).toContainText("2031");
    await expect(arrangements.getByTestId("confirmed-equipment")).toHaveText(
      "Projector × 2",
    );
  });

  test("SCRUM-81 [AC4] TC-81-03: while the checklist is incomplete, Confirm is unavailable and the outstanding items are listed", async ({
    page,
  }) => {
    const name = `SCRUM-81 Not ready ${Date.now()}`;
    const eventId = await planningEvent(name);
    eventIds.push(eventId);
    await prisma.booking.create({
      data: {
        eventId,
        venueId: "ven_seminar",
        ...PERIOD,
        status: "PENDING",
        requestedById: "usr_coordinator",
      },
    });

    await signIn(page, "coordinator@test.local");
    const dialog = await openDetails(page, name);
    await expect(dialog.getByTestId("readiness-item-venue")).toContainText(
      "Pending",
    );
    await expect(dialog.getByTestId("readiness-summary")).toHaveText(
      /Not ready to confirm yet/,
    );
    await expect(
      dialog.getByRole("button", { name: "Confirm event" }),
    ).toBeDisabled();
  });
});
