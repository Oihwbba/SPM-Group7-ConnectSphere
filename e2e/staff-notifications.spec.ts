import { test, expect } from "@playwright/test";

import { prisma } from "@/lib/db";
import { choose, signedIn, usesLocalDatabase, openBooking } from "./helpers";

/**
 * SCRUM-124 — staff and arrangement notifications in a real browser: a
 * Coordinator's venue request reaches Venue Staff through their notification
 * list, and Venue Staff's decision reaches the Coordinator through theirs
 * (AC15), each opening the page it is about (AC12). The rules behind every
 * trigger are in tests/unit and tests/integration/staff-notifications.test.ts.
 * Test cases: docs/testing/SCRUM-124.md.
 *
 * Its events are its own, on the Exhibition Hall in November 2036, clear of
 * anything seeded or booked by other specs, and are removed afterwards with
 * the notices about them.
 */
const STAMP = Date.now();
const PREFIX = "SCRUM-124 E2E";

async function planningEvent(label: string) {
  const name = `${PREFIX} ${label} ${STAMP}`;
  const { id } = await prisma.event.create({
    data: {
      name,
      status: "PLANNING",
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      startAt: new Date("2036-11-02T09:00:00+08:00"),
      endAt: new Date("2036-11-02T11:00:00+08:00"),
      expectedAttendance: 50,
      preferredLayout: "theatre",
    },
    select: { id: true },
  });
  return { id, name };
}

test.describe("SCRUM-124 — staff and arrangement notifications", () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  const eventIds: string[] = [];

  test.afterAll(async () => {
    const bookings = await prisma.booking.findMany({
      where: { eventId: { in: eventIds } },
      select: { id: true },
    });
    await prisma.notification.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...bookings.map((b) => b.id), ...eventIds] } },
    });
    await prisma.booking.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
  });

  test("SCRUM-124 [AC1, AC4, AC12, AC15] TC-124-01, TC-124-04: Venue Staff learn of a request from their notifications, and the Coordinator learns it was approved from theirs", async ({
    browser,
  }, testInfo) => {
    const event = await planningEvent(`Approve ${testInfo.retry}`);
    eventIds.push(event.id);

    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto("/bookings/new");
    await coordinator.locator('[data-hydrated="true"]').waitFor();
    await choose(coordinator, "Event", event.name);
    await choose(coordinator, "Room layout", /^theatre$/);
    await choose(coordinator, "Venue", /^Exhibition Hall/);
    await expect(coordinator.getByTestId("live-availability")).toHaveAttribute(
      "data-state",
      "free",
    );
    await coordinator.getByRole("button", { name: "Submit request" }).click();
    await expect(coordinator.getByTestId("booking-success")).toContainText(
      "Request submitted",
    );

    // AC1, AC15: in Venue Staff's own list, naming the venue and the event.
    const staff = await signedIn(browser, "venuestaff@test.local");
    await staff.goto("/notifications");
    const requested = staff
      .getByTestId("notification")
      .filter({ hasText: event.name });
    await expect(requested).toHaveCount(1);
    await expect(requested).toContainText("A venue was requested");
    await expect(requested).toContainText("Exhibition Hall");
    // AC12: it opens their queue, where they decide.
    await requested.click();
    await staff.waitForURL(/\/bookings$/);
    const card = await openBooking(staff, event.name);
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(
      staff.getByTestId("decision-done").getByText(/^Approved: Exhibition Hall is now booked/),
    ).toBeVisible();

    // AC4, AC15: the Coordinator's own list, opening the event.
    await coordinator.goto("/notifications");
    const approved = coordinator
      .getByTestId("notification")
      .filter({ hasText: event.name });
    await expect(approved).toHaveCount(1);
    await expect(approved).toContainText("Your venue request was approved");
    await approved.click();
    // SCRUM-208: the notice opens the event's own page.
    await coordinator.waitForURL(new RegExp(`/events/${event.id}$`));
  });

  test("SCRUM-124 [AC4, AC12] TC-124-04: rejecting a request in the queue tells the Coordinator the reason", async ({
    browser,
  }, testInfo) => {
    const event = await planningEvent(`Reject ${testInfo.retry}`);
    eventIds.push(event.id);
    await prisma.booking.create({
      data: {
        eventId: event.id,
        venueId: "ven_hall",
        startAt: new Date("2036-11-02T09:00:00+08:00"),
        endAt: new Date("2036-11-02T11:00:00+08:00"),
        status: "PENDING",
        requestedAttendance: 50,
        requestedById: "usr_coordinator",
      },
    });

    const staff = await signedIn(browser, "venuestaff@test.local");
    await staff.goto("/bookings");
    const card = await openBooking(staff, event.name);
    await card.getByRole("button", { name: "Reject" }).click();
    await staff.getByLabel("Rejection reason").fill("The hall is closed for repairs.");
    await staff.getByRole("button", { name: "Reject request" }).click();
    await expect(
      staff.getByTestId("decision-done").getByText("Rejected the request for"),
    ).toBeVisible();

    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto("/notifications");
    const rejected = coordinator
      .getByTestId("notification")
      .filter({ hasText: event.name });
    await expect(rejected).toHaveCount(1);
    await expect(rejected).toContainText("Your venue request was rejected");
    await expect(rejected).toContainText("Their reason: The hall is closed for repairs.");
  });
});
