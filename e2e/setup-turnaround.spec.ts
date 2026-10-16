import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { choose, signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-159 — a venue's setup and turnaround time in a real browser: the
 * availability calendar shows them either side of an approved booking, marked
 * differently from it (AC7), and a request whose setup would run into that
 * booking's turnaround is refused by the live check, with the whole occupied
 * time named (AC3), while one clear of it is free.
 *
 * Uses its own venue (30 minutes' setup, 45 minutes' turnaround) and events
 * on 12 Feb 2036, and removes them afterwards. The approved booking is written
 * straight to the database with the minutes it would have been approved with
 * (AC8), as if Venue Staff had approved it earlier.
 */
const DAY = "2036-02-12";
const PREFIX = "E2E Setup and turnaround —";
const VENUE = `${PREFIX} Hall`;
const BOOKED_EVENT = `${PREFIX} Morning Conference`;
// 12:30–14:30: its setup would start at 12:00, inside the turnaround to 12:45.
const CLOSE_EVENT = `${PREFIX} Lunchtime Talk`;
// 13:30–15:30: its setup starts at 13:00, after the turnaround ends.
const CLEAR_EVENT = `${PREFIX} Afternoon Workshop`;

const at = (hhmm: string) => new Date(`${DAY}T${hhmm}:00+08:00`);

async function removeTestData() {
  const events = await prisma.event.findMany({
    where: { name: { startsWith: PREFIX } },
    select: { id: true },
  });
  const venues = await prisma.venue.findMany({
    where: { name: { startsWith: PREFIX } },
    select: { id: true },
  });
  const bookings = await prisma.booking.findMany({
    where: {
      OR: [
        { eventId: { in: events.map((e) => e.id) } },
        { venueId: { in: venues.map((v) => v.id) } },
      ],
    },
    select: { id: true },
  });
  await prisma.auditLog.deleteMany({
    where: {
      entityType: "Booking",
      entityId: { in: bookings.map((b) => b.id) },
    },
  });
  await prisma.booking.deleteMany({
    where: { id: { in: bookings.map((b) => b.id) } },
  });
  await prisma.event.deleteMany({
    where: { id: { in: events.map((e) => e.id) } },
  });
  await prisma.venue.deleteMany({
    where: { id: { in: venues.map((v) => v.id) } },
  });
}

/** The stretches one day is split into on the week grid, as spoken: [kind, words]. */
async function stretches(page: Page, day: string) {
  return page
    .locator(`[data-view="week"] li[data-day="${day}"] li[data-kind]`)
    .evaluateAll((lis) =>
      lis.map((li) => [
        li.getAttribute("data-kind"),
        li.querySelector("[data-summary]")?.textContent?.trim() ?? "",
      ]),
    );
}

async function requestHall(page: Page, event: string) {
  await page.goto("/bookings/new");
  await page.locator('[data-hydrated="true"]').waitFor();
  await choose(page, "Event", event);
  await choose(page, "Room layout", /^theatre$/);
  await choose(page, "Venue", new RegExp(`^${VENUE}`));
}

test.describe("SCRUM-159 — setup and turnaround time", () => {
  test.describe.configure({ timeout: 120_000 });

  let venueId = "";

  test.beforeAll(async () => {
    if (!usesLocalDatabase) return;
    await removeTestData();
    const venue = await prisma.venue.create({
      data: {
        name: VENUE,
        location: "Test block",
        capacity: 200,
        supportedLayouts: ["theatre"],
        setupMinutes: 30,
        turnaroundMinutes: 45,
      },
      select: { id: true },
    });
    venueId = venue.id;

    const event = (name: string, start: string, end: string) => ({
      name,
      status: "PLANNING" as const,
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      startAt: at(start),
      endAt: at(end),
      expectedAttendance: 100,
      preferredLayout: "theatre",
    });
    await prisma.event.createMany({
      data: [
        event(BOOKED_EVENT, "10:00", "12:00"),
        event(CLOSE_EVENT, "12:30", "14:30"),
        event(CLEAR_EVENT, "13:30", "15:30"),
      ],
    });
    const booked = await prisma.event.findFirstOrThrow({
      where: { name: BOOKED_EVENT },
      select: { id: true },
    });
    await prisma.booking.create({
      data: {
        eventId: booked.id,
        venueId,
        startAt: at("10:00"),
        endAt: at("12:00"),
        status: "APPROVED",
        requestedAttendance: 100,
        requestedById: "usr_coordinator",
        decidedById: "usr_venuestaff",
        decidedAt: new Date(),
        setupMinutes: 30,
        turnaroundMinutes: 45,
      },
    });
  });

  test.afterAll(async () => {
    if (usesLocalDatabase) await removeTestData();
  });

  test("SCRUM-159 [AC7] TC-159-10: the calendar shows the booking's setup before it and turnaround after it, as their own kinds", async ({
    browser,
  }, testInfo) => {
    test.skip(!usesLocalDatabase, "creates its own venue and events");
    const coordinator = await signedIn(browser, "coordinator@test.local");

    await coordinator.goto(`/venues/availability?venue=${venueId}&week=${DAY}`);

    expect(await stretches(coordinator, DAY)).toEqual([
      ["free", "Available midnight to 9:30 am SGT"],
      ["setup", `Setup for ${BOOKED_EVENT} 9:30 am SGT to 10:00 am SGT`],
      ["booking", "Booked 10:00 am SGT to 12:00 pm SGT"],
      [
        "turnaround",
        `Turnaround for ${BOOKED_EVENT} 12:00 pm SGT to 12:45 pm SGT`,
      ],
      ["free", "Available 12:45 pm SGT to midnight"],
    ]);
    // The legend names the two new kinds.
    const legend = coordinator.getByRole("list", { name: "Legend" });
    await expect(legend).toContainText("Setup");
    await expect(legend).toContainText("Turnaround");

    await coordinator.setViewportSize({ width: 1280, height: 1100 });
    await testInfo.attach("SCRUM-159 setup and turnaround on the calendar", {
      body: await coordinator.screenshot({ fullPage: false }),
      contentType: "image/png",
    });
  });

  test("SCRUM-159 [AC3] TC-159-05, TC-159-06: a request whose setup runs into the booking's turnaround is refused by the live check; one clear of it is free", async ({
    browser,
  }) => {
    test.skip(!usesLocalDatabase, "creates its own venue and events");
    const coordinator = await signedIn(browser, "coordinator@test.local");

    await requestHall(coordinator, CLOSE_EVENT);
    await expect(coordinator.getByTestId("live-availability")).toContainText(
      `${VENUE} is unavailable for this period: already booked from 12 Feb 2036, 9:30 am SGT to 12 Feb 2036, 12:45 pm SGT, including setup and turnaround.`,
    );
    await expect(
      coordinator.getByRole("button", { name: "Submit request" }),
    ).toBeDisabled();

    await requestHall(coordinator, CLEAR_EVENT);
    await expect(coordinator.getByTestId("live-availability")).toHaveAttribute(
      "data-state",
      "free",
    );
  });
});
