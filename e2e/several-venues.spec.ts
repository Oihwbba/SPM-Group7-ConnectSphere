import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { choose, signedIn, usesLocalDatabase, openEvent } from "./helpers";

/**
 * SCRUM-162 — one event books several venues: a main hall and a breakout
 * room. Each test writes its own 2038 event, clear of anything seeded and of
 * the Exhibition Hall the bookings spec clears, and removes it afterwards.
 */
const PREFIX = "E2E Several Venues —";

async function removeTestEvents() {
  const ids = (
    await prisma.event.findMany({
      where: { name: { startsWith: PREFIX } },
      select: { id: true },
    })
  ).map((e) => e.id);
  const bookingIds = (
    await prisma.booking.findMany({
      where: { eventId: { in: ids } },
      select: { id: true },
    })
  ).map((b) => b.id);
  await prisma.notification.deleteMany({
    where: { OR: [{ eventId: { in: ids } }, { bookingId: { in: bookingIds } }] },
  });
  await prisma.auditLog.deleteMany({
    where: { entityId: { in: [...ids, ...bookingIds] } },
  });
  await prisma.booking.deleteMany({ where: { eventId: { in: ids } } });
  await prisma.event.deleteMany({ where: { id: { in: ids } } });
}

const START = new Date("2038-08-12T09:00:00+08:00");
const END = new Date("2038-08-12T13:00:00+08:00");
// The tests run in parallel, so each books the venues on its own day.
const OPEN_DAY = {
  startAt: new Date("2038-08-19T09:00:00+08:00"),
  endAt: new Date("2038-08-19T13:00:00+08:00"),
};
type Period = { startAt: Date; endAt: Date };

async function createEvent(
  name: string,
  status: "PLANNING" | "CONFIRMED",
  period: Period = { startAt: START, endAt: END },
) {
  const event = await prisma.event.create({
    data: {
      name: `${PREFIX} ${name} ${Date.now()}`,
      purpose: "Several venues",
      description: "Owned by the SCRUM-162 e2e spec.",
      status,
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      ...period,
      expectedAttendance: 300,
      registrationRequired: true,
      registrationEnabled: true,
    },
    select: { id: true, name: true },
  });
  return event;
}

/** An Approved booking written directly, as Venue Staff would leave it. */
function approved(
  eventId: string,
  venueId: string,
  attendance: number,
  period: Period = { startAt: START, endAt: END },
) {
  return prisma.booking.create({
    data: {
      eventId,
      venueId,
      ...period,
      status: "APPROVED",
      requestedAttendance: attendance,
      requestedById: "usr_coordinator",
      decidedById: "usr_venuestaff",
      decidedAt: new Date(),
    },
  });
}

/** SCRUM-208: the event's page, on the tab this journey works in. */
async function openDetails(page: Page, eventName: string, tab = "Arrangements") {
  return openEvent(page, eventName, tab);
}

test.describe("SCRUM-162 — Book several venues for one event", () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  test.beforeAll(async () => {
    if (usesLocalDatabase) await removeTestEvents();
  });

  test.afterAll(async () => {
    if (usesLocalDatabase) await removeTestEvents();
  });

  test("SCRUM-162 [AC1, AC7, AC8] TC-162-01, TC-162-11, TC-162-12, TC-162-13: a Coordinator requests a hall and a breakout room for one event, sees both, and withdraws one", async ({
    browser,
  }) => {
    const event = await createEvent("Graduation", "PLANNING");
    const coordinator = await signedIn(browser, "coordinator@test.local");

    // AC1: the main hall, for the whole attendance.
    await coordinator.goto("/bookings/new");
    await coordinator.locator('[data-hydrated="true"]').waitFor();
    await choose(coordinator, "Event", event.name);
    await choose(coordinator, "Room layout", /^theatre$/);
    await choose(coordinator, "Venue", /^Grand Auditorium/);
    await expect(coordinator.getByTestId("live-availability")).toHaveAttribute(
      "data-state",
      "free",
    );
    await coordinator.getByRole("button", { name: "Submit request" }).click();
    const success = coordinator.getByTestId("booking-success");
    await expect(success).toContainText("Grand Auditorium");
    await success.getByRole("button", { name: "Done" }).click();

    // AC1, AC4: a breakout room for 40 of them, for the same event.
    await choose(coordinator, "Event", event.name);
    await choose(coordinator, "Room layout", /^classroom$/);
    await choose(coordinator, "Venue", /^Seminar Room 2\.1/);
    await coordinator.getByLabel("Expected attendance").fill("40");
    await expect(coordinator.getByTestId("live-availability")).toHaveAttribute(
      "data-state",
      "free",
    );
    await coordinator.getByRole("button", { name: "Submit request" }).click();
    await expect(success).toContainText("Seminar Room 2.1");
    await success.getByRole("button", { name: "Done" }).click();

    const rows = await prisma.booking.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, venueId: true, requestedAttendance: true },
    });
    expect(rows.map((r) => [r.venueId, r.requestedAttendance])).toEqual([
      ["ven_auditorium", 300],
      ["ven_seminar", 40],
    ]);

    // Venue Staff approve the hall; the breakout room is still pending.
    await prisma.booking.update({
      where: { id: rows[0].id },
      data: {
        status: "APPROVED",
        decidedById: "usr_venuestaff",
        decidedAt: new Date(),
      },
    });

    // AC7: the event page lists both bookings with attendance and status.
    const details = await openDetails(coordinator, event.name);
    const card = details.getByTestId("venue-bookings-panel");
    const bookings = card.getByTestId("event-venue-booking");
    await expect(bookings).toHaveCount(2);
    await expect(bookings.nth(0)).toContainText("Grand Auditorium · 300 people");
    await expect(bookings.nth(0)).toHaveAttribute("data-status", "APPROVED");
    await expect(bookings.nth(1)).toContainText("Seminar Room 2.1 · 40 people");
    await expect(bookings.nth(1)).toHaveAttribute("data-status", "PENDING");

    // AC8: the checklist lists each booking, and a pending one keeps the
    // venue incomplete even beside an approval.
    const venueItem = details.getByTestId("readiness-item-venue");
    await expect(venueItem).toHaveAttribute("data-complete", "false");
    const lines = venueItem.getByTestId("venue-booking");
    await expect(lines).toHaveCount(2);
    await expect(lines.nth(1)).toContainText("Seminar Room 2.1");

    // Withdrawing the breakout room completes the venue, and the bookings
    // card beside it updates without reopening the event.
    await lines
      .nth(1)
      .getByRole("button", { name: "Withdraw request" })
      .click();
    await coordinator
      .getByRole("dialog", { name: "Withdraw this venue request?" })
      .getByRole("button", { name: "Withdraw request" })
      .click();
    await expect(venueItem).toHaveAttribute("data-complete", "true");
    await expect(lines).toHaveCount(1);
    await expect(bookings.nth(1)).toHaveAttribute("data-status", "CANCELLED");
  });

  test("SCRUM-162 [AC7] TC-162-11: once Confirmed, the Organiser and Attendees see every approved venue", async ({
    browser,
  }) => {
    const event = await createEvent("Open Day", "CONFIRMED", OPEN_DAY);
    await approved(event.id, "ven_auditorium", 300, OPEN_DAY);
    await approved(event.id, "ven_seminar", 40, OPEN_DAY);

    const organiser = await signedIn(browser, "organiser@test.local");
    const details = await openDetails(organiser, event.name);
    const venues = details.getByTestId("confirmed-venue");
    await expect(venues).toContainText("Grand Auditorium");
    await expect(venues).toContainText("Seminar Room 2.1");

    const attendee = await signedIn(browser, "attendee@test.local");
    await attendee.goto("/events");
    const card = attendee
      .getByTestId("browsable-event-card")
      .filter({ hasText: event.name });
    await expect(card.getByTestId("venue")).toContainText("Grand Auditorium");
    await expect(card.getByTestId("venue")).toContainText("Seminar Room 2.1");

    await attendee.goto(`/events/${event.id}`);
    await expect(attendee.getByTestId("venue")).toHaveCount(2);
  });
});
