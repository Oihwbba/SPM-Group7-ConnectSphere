import { test, expect } from "@playwright/test";

import { prisma } from "@/lib/db";
import { signedIn, usesLocalDatabase, openBooking, openMenuGroup } from "./helpers";

/**
 * SCRUM-121 — one account with several roles in a real browser, as the seeded
 * multirole@test.local: Venue Staff, with Technical Support, Coordinator and
 * Organiser as additional roles. The navigation and the user menu show every
 * role (AC1, AC2), the events page switches between its Coordinator and
 * Organiser views (AC2), and approving the booking of an event it coordinates
 * is refused (AC5). The rules behind them are in
 * tests/unit/multiple-roles*.test.ts and tests/integration/multiple-roles.test.ts.
 * Test cases: docs/testing/SCRUM-121.md.
 *
 * Its events and venue are its own, in 2037, and are removed afterwards.
 */
const STAMP = Date.now();
const ME = "usr_multirole";
const START = new Date("2037-03-09T09:00:00+08:00");
const END = new Date("2037-03-09T12:00:00+08:00");

async function planningEvent(label: string, organiserId: string, coordinatorId: string) {
  const name = `SCRUM-121 E2E ${label} ${STAMP}`;
  const { id } = await prisma.event.create({
    data: {
      name,
      status: "PLANNING",
      organiserId,
      coordinatorId,
      startAt: START,
      endAt: END,
      expectedAttendance: 40,
    },
    select: { id: true },
  });
  return { id, name };
}

test.describe("SCRUM-121 — accounts with several roles", () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  const eventIds: string[] = [];
  const venueIds: string[] = [];

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
    await prisma.venue.deleteMany({ where: { id: { in: venueIds } } });
  });

  test("SCRUM-121 [AC1, AC2] TC-121-01, TC-121-02: the navigation has every role's pages once, and the user menu names every role", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "multirole@test.local");
    // The primary role's landing page.
    await page.waitForURL(/\/bookings$/);

    const nav = page.getByRole("complementary", { name: "Primary" });
    // SCRUM-210: Request Venue is under Venues, which opens to show it.
    await openMenuGroup(page, "Venues");
    for (const label of [
      "Bookings", // Venue Staff
      "Equipment", // Technical Support
      "Equipment Requests", // Technical Support
      "Request Venue", // Coordinator
      "Events", // Coordinator and Organiser
    ]) {
      await expect(nav.getByRole("link", { name: label, exact: true })).toHaveCount(1);
    }
    // The events page is named as the Coordinator names it, and an
    // Attendee's pages stay out.
    await expect(nav.getByRole("link", { name: "My Events", exact: true })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Browse Events", exact: true })).toHaveCount(0);
    // Notifications are reached from the bell beside the name, not the menu.
    await expect(nav.getByRole("link", { name: "Notifications", exact: true })).toHaveCount(0);

    const menu = page.getByRole("button", { name: "Open user menu" });
    await expect(menu).toContainText("Venue Staff +3");
    await menu.click();
    await expect(page.getByRole("menu")).toContainText(
      "Venue Staff · Technical Support · Event Coordinator · Event Organiser",
    );
  });

  test("SCRUM-121 [AC2, AC3] TC-121-02, TC-121-03: the events page shows the event it coordinates as Coordinator and the event it organises as Organiser", async ({
    browser,
  }, testInfo) => {
    const coordinated = await planningEvent(`Coordinated ${testInfo.retry}`, "usr_organiser_2", ME);
    const organised = await planningEvent(`Organised ${testInfo.retry}`, ME, "usr_coordinator_2");
    eventIds.push(coordinated.id, organised.id);

    const page = await signedIn(browser, "multirole@test.local");
    await page.goto("/events");
    const views = page.getByRole("navigation", { name: "View events as" });
    const asCoordinator = views.getByRole("link", { name: "Event Coordinator" });
    const asOrganiser = views.getByRole("link", { name: "Event Organiser" });

    // The first role held with an events view opens first.
    await expect(asCoordinator).toHaveAttribute("aria-current", "page");
    await expect(page.getByText(coordinated.name)).toBeVisible();
    await expect(page.getByText(organised.name)).toHaveCount(0);

    await asOrganiser.click();
    await page.waitForURL(/\/events\?as=ORGANISER$/);
    await expect(asOrganiser).toHaveAttribute("aria-current", "page");
    await expect(page.getByText(organised.name)).toBeVisible();
    await expect(page.getByText(coordinated.name)).toHaveCount(0);

    // AC3: only a view of a role it holds can be asked for; an Attendee's
    // opens the first view instead.
    await page.goto("/events?as=ATTENDEE");
    await expect(asCoordinator).toHaveAttribute("aria-current", "page");
    await expect(views.getByRole("link")).toHaveCount(2);
    await expect(page.getByText(coordinated.name)).toBeVisible();
  });

  test("SCRUM-121 [AC2] TC-121-02: equipment requests switch between Technical Support's review queue and the Coordinator's own requests", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "multirole@test.local");
    await page.goto("/equipment-requests");
    const views = page.getByRole("navigation", { name: "Equipment requests view" });
    const queue = views.getByRole("link", { name: "Review queue" });
    const mine = views.getByRole("link", { name: "My requests" });

    await expect(queue).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Review what coordinators need")).toBeVisible();

    await mine.click();
    await page.waitForURL(/\/equipment-requests\?view=mine$/);
    await expect(mine).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Tell Technical Support what your events need")).toBeVisible();
    await expect(page.getByText("Review what coordinators need")).toHaveCount(0);
  });

  test("SCRUM-121 [AC5] TC-121-05: approving the venue booking of an event it coordinates is refused, and the request stays pending", async ({
    browser,
  }, testInfo) => {
    const event = await planningEvent(`Own booking ${testInfo.retry}`, "usr_organiser_2", ME);
    eventIds.push(event.id);
    const { id: venueId } = await prisma.venue.create({
      data: { name: `SCRUM-121 E2E venue ${STAMP} ${testInfo.retry}`, location: "Test block", capacity: 500 },
      select: { id: true },
    });
    venueIds.push(venueId);
    const { id: bookingId } = await prisma.booking.create({
      data: {
        eventId: event.id,
        venueId,
        startAt: START,
        endAt: END,
        status: "PENDING",
        requestedAttendance: 40,
        requestedById: ME,
      },
      select: { id: true },
    });

    const page = await signedIn(browser, "multirole@test.local");
    await page.goto("/bookings");
    const card = await openBooking(page, event.name);
    await card.getByRole("button", { name: "Approve" }).click();

    await expect(page.getByText("You do not have permission to do that.")).toBeVisible();
    await expect(card).toHaveCount(1);
    expect(
      await prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, select: { status: true } }),
    ).toEqual({ status: "PENDING" });
    expect(await prisma.auditLog.count({ where: { entityId: bookingId } })).toBe(0);
  });
});
