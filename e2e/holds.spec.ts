import { test, expect, type Page } from "@playwright/test";

import { prisma } from "@/lib/db";
import {
  formatDateTime,
  parseSingaporeDateTime,
  utcToSgWallTime,
} from "@/lib/datetime";
import { setTime, signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-163 — Venue Staff hold a pending request until a deadline and approve
 * the hold, and the event's Coordinator then confirms it from the readiness
 * checklist (Week 9 clarification of AC3 and AC7). Each
 * test owns its event, venue and request (written straight to the database)
 * so it can't collide with the seeded bookings, and removes them afterwards.
 * The event is about six weeks away, so the date picker only steps a month
 * or two. Test cases: docs/testing/SCRUM-163.md.
 */
const STAMP = Date.now();
const DAY = 24 * 60 * 60 * 1000;
/** "YYYY-MM-DD" in Singapore, `days` from today. */
const sgDay = (days: number) =>
  utcToSgWallTime(new Date(Date.now() + days * DAY)).slice(0, 10);
// 9 am to 5 pm Singapore time, 40 days from now.
const PERIOD = {
  startAt: parseSingaporeDateTime(`${sgDay(40)}T09:00`)!,
  endAt: parseSingaporeDateTime(`${sgDay(40)}T17:00`)!,
};
const EXPIRY = `${sgDay(20)}T10:00`;
const AFTER_START = `${sgDay(41)}T10:00`;
const heldUntil = `Held until ${formatDateTime(parseSingaporeDateTime(EXPIRY)!)}`;

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

  test("SCRUM-163 [AC1, AC3, AC6, AC7] TC-163-01, TC-163-06, TC-163-11, TC-163-12, TC-163-16, TC-163-17: Venue Staff hold a request and approve the hold, and only then its Coordinator confirms it", async ({
    browser,
  }) => {
    const request = await pendingRequest("Confirm");
    made.push(request);

    const staff = await signedIn(browser, "venuestaff@test.local");
    const card = await placeHold(staff, request.bookingId, EXPIRY);

    await expect(card).toContainText(heldUntil);
    await expect(card).toContainText("Confirm the final headcount.");
    await expect(card.getByRole("button", { name: "Hold" })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Reject" })).toBeVisible();

    // AC3: before Venue Staff approve the hold, Confirm hold is unavailable.
    const coordinator = await signedIn(browser, "coordinator@test.local");
    const openVenueItem = async () => {
      await coordinator
        .getByRole("row", { name: new RegExp(request.name) })
        .getByTestId("view-details-button")
        .click();
      return coordinator.getByRole("dialog").getByTestId("readiness-item-venue");
    };
    let venueItem = await openVenueItem();
    await expect(venueItem).toContainText(
      `${heldUntil} – confirm to secure`,
    );
    await expect(venueItem).toContainText(
      "Waiting for Venue Staff to approve the hold before it can be confirmed.",
    );
    await expect(
      venueItem.getByRole("button", { name: "Confirm hold" }),
    ).toBeDisabled();

    // AC7: Venue Staff approve the hold once; it stays Held.
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(card).toContainText(
      "Approved by Venue Staff – awaiting confirmation",
    );
    await expect(card).toContainText(heldUntil);
    await expect(card.getByRole("button", { name: "Approve" })).toHaveCount(0);

    await coordinator.reload();
    venueItem = await openVenueItem();
    await expect(venueItem).toContainText(
      "Approved by Venue Staff – awaiting confirmation.",
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
    const card = await placeHold(staff, request.bookingId, AFTER_START);

    await expect(
      staff
        .getByRole("dialog")
        .getByText(
          `The hold must expire after now and before the booking starts (${formatDateTime(PERIOD.startAt)}).`,
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

  test("SCRUM-163 [AC3] TC-163-07: the Coordinator releases a hold, and the venue is free again", async ({
    browser,
  }) => {
    const request = await pendingRequest("Release");
    made.push(request);
    await prisma.booking.update({
      where: { id: request.bookingId },
      data: {
        status: "HELD",
        heldAt: new Date(),
        holdExpiresAt: parseSingaporeDateTime(EXPIRY)!,
        holdNote: "Confirm the final headcount.",
      },
    });

    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator
      .getByRole("row", { name: new RegExp(request.name) })
      .getByTestId("view-details-button")
      .click();
    const venueItem = coordinator
      .getByRole("dialog")
      .getByTestId("readiness-item-venue");
    await expect(venueItem).toContainText(`${heldUntil} – confirm to secure`);

    await venueItem.getByRole("button", { name: "Release hold" }).click();

    await expect(venueItem).toContainText("Not requested");
    expect(
      (
        await prisma.booking.findUniqueOrThrow({
          where: { id: request.bookingId },
          select: { status: true },
        })
      ).status,
    ).toBe("CANCELLED");
  });
});
