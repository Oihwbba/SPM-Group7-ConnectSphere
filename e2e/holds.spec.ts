import { test, expect, type Page } from "@playwright/test";

import { prisma } from "@/lib/db";
import { setTime, signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-163 — Venue Staff hold a pending request until a deadline, and the
 * event's Coordinator confirms the hold from the readiness checklist. Each
 * test owns its event, venue and request (written straight to the database)
 * so it can't collide with the seeded bookings, and removes them afterwards.
 * Test cases: docs/testing/SCRUM-163.md.
 */
const STAMP = Date.now();
// 1 July 2031, 9 am to 5 pm Singapore time.
const PERIOD = {
  startAt: new Date("2031-07-01T01:00:00Z"),
  endAt: new Date("2031-07-01T09:00:00Z"),
};

async function pendingRequest(label: string) {
  const name = `SCRUM-163 ${label} ${STAMP}`;
  const venue = await prisma.venue.create({
    data: { name: `${name} venue`, location: "Test block", capacity: 200 },
    select: { id: true },
  });
  const event = await prisma.event.create({
    data: {
      name,
      purpose: "Hold journey",
      description: "Owned by the SCRUM-163 e2e spec.",
      status: "PLANNING",
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      ...PERIOD,
      expectedAttendance: 40,
      submittedAt: new Date(),
    },
    select: { id: true },
  });
  const booking = await prisma.booking.create({
    data: {
      eventId: event.id,
      venueId: venue.id,
      ...PERIOD,
      status: "PENDING",
      requestedAttendance: 40,
      requestedById: "usr_coordinator",
    },
    select: { id: true },
  });
  return { name, eventId: event.id, venueId: venue.id, bookingId: booking.id };
}

async function placeHold(page: Page, bookingId: string, expiry: string) {
  await page.goto("/bookings");
  const card = page.getByTestId(`booking-${bookingId}`);
  await card.getByRole("button", { name: "Hold" }).click();
  const dialog = page.getByRole("dialog");
  await setTime(page, "Expiry", expiry);
  await dialog
    .getByLabel("What the Coordinator must finalise")
    .fill("Confirm the final headcount.");
  await dialog.getByRole("button", { name: "Hold venue" }).click();
  return card;
}

test.describe("SCRUM-163 — Hold a venue tentatively until a deadline", () => {
  test.skip(!usesLocalDatabase, "writes its own requests; local database only");

  const made: Awaited<ReturnType<typeof pendingRequest>>[] = [];

  test.afterAll(async () => {
    const eventIds = made.map((m) => m.eventId);
    const bookingIds = made.map((m) => m.bookingId);
    await prisma.notification.deleteMany({
      where: { eventId: { in: eventIds } },
    });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...eventIds, ...bookingIds] } },
    });
    await prisma.booking.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.venue.deleteMany({
      where: { id: { in: made.map((m) => m.venueId) } },
    });
  });

  test("SCRUM-163 [AC1, AC3, AC6, AC7] TC-163-01, TC-163-06, TC-163-11, TC-163-12: Venue Staff hold a request, and its Coordinator confirms the hold", async ({
    browser,
  }) => {
    const request = await pendingRequest("Confirm");
    made.push(request);

    const staff = await signedIn(browser, "venuestaff@test.local");
    const card = await placeHold(staff, request.bookingId, "2031-06-30T10:00");

    await expect(card).toContainText("Held until 30 Jun 2031, 10:00 am SGT");
    await expect(card).toContainText("Confirm the final headcount.");
    await expect(card.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Reject" })).toBeVisible();

    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator
      .getByRole("row", { name: new RegExp(request.name) })
      .getByTestId("view-details-button")
      .click();
    const venueItem = coordinator
      .getByRole("dialog")
      .getByTestId("readiness-item-venue");
    await expect(venueItem).toContainText(
      "Held until 30 Jun 2031, 10:00 am SGT – confirm to secure",
    );
    await expect(venueItem).toHaveAttribute("data-complete", "false");

    await venueItem.getByRole("button", { name: "Confirm hold" }).click();

    await expect(venueItem).toContainText("Approved");
    await expect(venueItem).toHaveAttribute("data-complete", "true");
    expect(
      (
        await prisma.booking.findUniqueOrThrow({
          where: { id: request.bookingId },
          select: { status: true },
        })
      ).status,
    ).toBe("APPROVED");
  });

  test("SCRUM-163 [AC1] TC-163-02: a hold expiring after the booking starts is refused, and the request stays pending", async ({
    browser,
  }) => {
    const request = await pendingRequest("Too late");
    made.push(request);

    const staff = await signedIn(browser, "venuestaff@test.local");
    const card = await placeHold(staff, request.bookingId, "2031-07-02T10:00");

    await expect(
      staff
        .getByRole("dialog")
        .getByText(
          "The hold must expire after now and before the booking starts (1 Jul 2031, 9:00 am SGT).",
        ),
    ).toBeVisible();
    await staff.keyboard.press("Escape");
    await expect(card).toContainText("Pending");
    expect(
      (
        await prisma.booking.findUniqueOrThrow({
          where: { id: request.bookingId },
          select: { status: true },
        })
      ).status,
    ).toBe("PENDING");
  });
});
