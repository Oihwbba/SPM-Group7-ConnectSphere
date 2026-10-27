import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { usesLocalDatabase, openEvent } from "./helpers";

/**
 * SCRUM-110 — the readiness checklist on a Planning event's details. Each test
 * owns its events (created straight in the database) so it cannot collide with
 * the seeded evt_planning, which the booking specs decide on. It writes to the
 * database, so like the other writing specs it only runs against a localhost
 * database. Test cases: docs/testing/SCRUM-110.md.
 */

const REASON = "Boardroom seats 14; the event expects 55 attendees.";
const DAY_ONE = {
  startAt: new Date("2031-06-01T01:00:00Z"),
  endAt: new Date("2031-06-01T09:00:00Z"),
};
const DAY_TWO = {
  startAt: new Date("2031-06-02T01:00:00Z"),
  endAt: new Date("2031-06-02T09:00:00Z"),
};

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/events");
}

async function openChecklist(page: Page, eventName: string) {
  // SCRUM-208: the checklist is on the event page's Arrangements tab.
  const event = await openEvent(page, eventName, "Arrangements");
  const checklist = event.getByTestId("readiness-checklist");
  await expect(checklist).toBeVisible();
  return checklist;
}

async function planningEvent(name: string, period: typeof DAY_ONE) {
  const event = await prisma.event.create({
    data: {
      name,
      purpose: "Readiness checklist journey",
      description: "Owned by the SCRUM-110 e2e spec.",
      status: "PLANNING",
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      ...period,
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

test.describe("SCRUM-110 — See an event's readiness checklist", () => {
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

  test("SCRUM-110 [AC2, AC3, AC6] TC-110-04, TC-110-07, TC-110-11, TC-110-12: the Coordinator sees what is outstanding and why; the Organiser sees the same without the reason", async ({
    page,
  }) => {
    const name = `SCRUM-110 Not ready ${Date.now()}`;
    const eventId = await planningEvent(name, DAY_ONE);
    eventIds.push(eventId);
    await prisma.booking.create({
      data: {
        eventId,
        venueId: "ven_boardroom",
        ...DAY_ONE,
        status: "REJECTED",
        requestedById: "usr_coordinator",
        decidedById: "usr_venuestaff",
        decidedAt: new Date(),
        decisionReason: REASON,
      },
    });
    await prisma.equipmentRequest.create({
      data: {
        eventId,
        requestedById: "usr_coordinator",
        status: "APPROVED",
        lines: { create: [{ equipmentId: "eqp_projector", quantity: 5 }] },
      },
    });
    await prisma.reservation.create({
      data: {
        eventId,
        equipmentId: "eqp_projector",
        quantity: 3,
        ...DAY_ONE,
        status: "CONFIRMED",
        reservedById: "usr_techsupport",
      },
    });

    // The Coordinator: every outstanding item, with Venue Staff's reason.
    await signIn(page, "coordinator@test.local");
    let checklist = await openChecklist(page, name);
    const venue = checklist.getByTestId("readiness-item-venue");
    const equipment = checklist.getByTestId("readiness-item-equipment");
    await expect(venue).toHaveAttribute("data-complete", "false");
    // SCRUM-209: the state beside the section's title, the reason below it.
    await expect(venue.getByTestId("item-status")).toContainText("Rejected");
    await expect(venue.getByTestId("item-reason")).toHaveText(REASON);
    await expect(equipment).toHaveAttribute("data-complete", "false");
    // AC 4: the short item is named, without counts.
    await expect(equipment).toContainText("Not fully reserved: Projector");
    await expect(equipment).not.toContainText("3/5");
    await expect(checklist.getByTestId("readiness-summary")).toHaveText(
      /^[0-2]\/3 items completed$/,
    );

    // The Organiser: the same items and states, but not the internal reason.
    await signIn(page, "organiser@test.local");
    checklist = await openChecklist(page, name);
    await expect(checklist.getByTestId("readiness-item-venue")).toContainText(
      "Rejected",
    );
    await expect(checklist).not.toContainText(REASON);
    await expect(
      checklist.getByTestId("readiness-item-equipment"),
    ).toContainText("Not fully reserved: Projector");
  });

  test("SCRUM-110 [AC3, AC5, AC6] TC-110-01, TC-110-06: with the venue approved and every requested item reserved, the Coordinator sees Ready to confirm", async ({
    page,
  }) => {
    const name = `SCRUM-110 Ready ${Date.now()}`;
    const eventId = await planningEvent(name, DAY_TWO);
    eventIds.push(eventId);
    await prisma.booking.create({
      data: {
        eventId,
        venueId: "ven_hall",
        ...DAY_TWO,
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
        ...DAY_TWO,
        status: "CONFIRMED",
        reservedById: "usr_techsupport",
      },
    });
    // SCRUM-166 AC9: Ready to confirm also needs an approved safety check.
    await prisma.safetyCheck.create({
      data: {
        eventId,
        status: "APPROVED",
        requestedById: "usr_coordinator",
        decidedById: "usr_safetyofficer",
        decidedAt: new Date(),
      },
    });

    await signIn(page, "coordinator@test.local");
    const checklist = await openChecklist(page, name);
    await expect(checklist.getByTestId("readiness-item-venue")).toHaveAttribute(
      "data-complete",
      "true",
    );
    await expect(
      checklist.getByTestId("readiness-item-equipment"),
    ).toContainText("Reserved");
    await expect(checklist.getByTestId("readiness-summary")).toHaveText(
      "3/3 items completed · Ready to confirm",
    );
  });
});
