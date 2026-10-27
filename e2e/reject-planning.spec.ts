import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { usesLocalDatabase, openEvent } from "./helpers";

/**
 * SCRUM-117 — the assigned Coordinator rejects a Planning event whose
 * arrangements can't be secured. Each test creates its own event straight in
 * the database. Test cases: docs/testing/SCRUM-117.md.
 */

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/events");
}

/** SCRUM-208: the event's page, on the tab this journey works in. */
async function openDetails(page: Page, name: string, tab = "Arrangements") {
  return openEvent(page, name, tab);
}

const START = new Date("2032-04-01T01:00:00Z");
const END = new Date("2032-04-01T09:00:00Z");

async function planningEvent(name: string) {
  const event = await prisma.event.create({
    data: {
      name,
      purpose: "SCRUM-117 journey",
      description: "Owned by the SCRUM-117 e2e spec.",
      status: "PLANNING",
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      startAt: START,
      endAt: END,
      expectedAttendance: 60,
      venueRequirements: "Any room",
      requiredFacilities: [],
      accessibilityNeeds: "None",
      preferredLayout: "Classroom",
      equipmentRequirements: "Projector",
      registrationNotes: "None",
      submittedAt: new Date(),
    },
    select: { id: true },
  });
  return event.id;
}

test.describe("SCRUM-117 — Reject an event that can't be fulfilled", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  let eventId: string;

  test.afterEach(async () => {
    await prisma.notification.deleteMany({ where: { eventId } });
    await prisma.auditLog.deleteMany({ where: { entityId: eventId } });
    await prisma.reservation.deleteMany({ where: { eventId } });
    await prisma.booking.deleteMany({ where: { eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
  });

  test("SCRUM-117 [AC1, AC2, AC3, AC6] TC-117-09: the Coordinator rejects a Planning event; its arrangements are released and the Organiser sees why", async ({
    page,
  }) => {
    const name = `SCRUM-117 Reject ${Date.now()}`;
    const reason = "No venue can hold 60 people on that date.";
    eventId = await planningEvent(name);
    await prisma.booking.create({
      data: {
        eventId,
        venueId: "ven_hall",
        startAt: START,
        endAt: END,
        status: "APPROVED",
        requestedById: "usr_coordinator",
        decidedById: "usr_venuestaff",
        decidedAt: new Date(),
      },
    });
    await prisma.reservation.create({
      data: {
        eventId,
        equipmentId: "eqp_projector",
        quantity: 1,
        startAt: START,
        endAt: END,
        status: "CONFIRMED",
        reservedById: "usr_techsupport",
      },
    });

    await signIn(page, "coordinator@test.local");
    let details = await openDetails(page, name);
    await details.getByRole("button", { name: "Reject event" }).click();
    const dialog = page.getByRole("dialog", { name: /Reject this event/ });
    const confirmReject = dialog.getByRole("button", { name: "Reject event" });

    // Failure path (AC2): a reason alone isn't enough; an outcome is needed.
    await dialog.getByLabel("Rejection reason").fill(reason);
    await expect(confirmReject).toBeDisabled();
    await dialog.getByLabel("Submit as a new request").check();
    await confirmReject.click();
    await expect(
      page.getByText("Event rejected. Its arrangements were released."),
    ).toBeVisible();

    // AC1, AC3: Rejected, with the booking and the reservation released.
    expect(
      await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: {
          status: true,
          rejectionOutcome: true,
          bookings: { select: { status: true } },
          reservations: { select: { status: true } },
        },
      }),
    ).toEqual({
      status: "REJECTED",
      rejectionOutcome: "NEW_REQUEST",
      bookings: [{ status: "CANCELLED" }],
      reservations: [{ status: "CANCELLED" }],
    });

    // AC1, AC6: the Organiser sees the reason and the outcome.
    await signIn(page, "organiser@test.local");
    details = await openDetails(page, name);
    await expect(details.getByTestId("status-badge")).toHaveAttribute(
      "data-status",
      "REJECTED",
    );
    await expect(details.getByText(reason)).toBeVisible();
    await expect(details.getByTestId("rejection-outcome")).toHaveText(
      "Next step: Submit as a new request",
    );
  });

  test("SCRUM-117 [AC4, AC5] TC-117-10: Reject isn't offered on an event that was Confirmed before, nor to its Organiser", async ({
    page,
  }) => {
    const name = `SCRUM-117 Was Confirmed ${Date.now()}`;
    eventId = await planningEvent(name);
    // As if it had been confirmed (SCRUM-81) and later sent back to Planning.
    await prisma.auditLog.create({
      data: {
        entityType: "Event",
        entityId: eventId,
        action: "STATUS_CHANGED",
        actorId: "usr_coordinator",
        fieldName: "status",
        oldValue: "PLANNING",
        newValue: "CONFIRMED",
      },
    });

    await signIn(page, "coordinator@test.local");
    let details = await openDetails(page, name);
    await expect(details.getByTestId("readiness-checklist")).toBeVisible();
    await expect(
      details.getByRole("button", { name: "Reject event" }),
    ).toHaveCount(0);

    await signIn(page, "organiser@test.local");
    details = await openDetails(page, name);
    await expect(details.getByTestId("readiness-checklist")).toBeVisible();
    await expect(
      details.getByRole("button", { name: "Reject event" }),
    ).toHaveCount(0);
  });
});
