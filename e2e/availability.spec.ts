import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { choose, setTime, signedIn, usesLocalDatabase, openBooking } from "./helpers";

/**
 * SCRUM-36 / SCRUM-37 — the availability calendar and recorded unavailability
 * in a real browser: Venue Staff record maintenance, a Coordinator sees it on
 * the calendar and is refused a request over it, and a booking approved beside
 * it appears at once, flush against it. SCRUM-161: unavailability recorded
 * over an approved booking is shown first, then saved, flagging the booking
 * and telling its Coordinator.
 *
 * Uses the Grand Auditorium on 10 and 12 Jan 2036, clear of anything seeded, and
 * clears those rows first so a local re-run or a CI retry starts clean. A
 * request is always for its event's period (SCRUM-50 AC1), so the spec
 * creates the two events it requests for, and removes them afterwards.
 */
const AUDITORIUM = "ven_auditorium";
const DAY = "2036-01-10";
const PREFIX = "E2E Auditorium —";
// Over the maintenance recorded below, and ending exactly as it begins.
const CLASHING_EVENT = `${PREFIX} Afternoon Rehearsal`;
const MORNING_EVENT = `${PREFIX} Morning Assembly`;
// Booked straight into the database, as if approved by someone else.
const ELSEWHERE_EVENT = `${PREFIX} Approved Elsewhere`;
// SCRUM-161: approved on its own day, then made unavailable under it.
const FLAGGED_DAY = "2036-01-12";
const FLAGGED_EVENT = `${PREFIX} Flagged Conference`;

async function removeTestEvents() {
  const events = await prisma.event.findMany({
    where: { name: { startsWith: PREFIX } },
    select: { id: true },
  });
  const eventIds = events.map((e) => e.id);
  const bookings = await prisma.booking.findMany({
    where: { eventId: { in: eventIds } },
    select: { id: true },
  });
  await prisma.auditLog.deleteMany({
    where: {
      entityType: "Booking",
      entityId: { in: bookings.map((b) => b.id) },
    },
  });
  await prisma.notification.deleteMany({
    where: { eventId: { in: eventIds } },
  });
  await prisma.booking.deleteMany({ where: { eventId: { in: eventIds } } });
  await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
}

/** The calendar for the week containing `day`. */
const calendarFor = (venue: string, day: string) =>
  `/venues/availability?venue=${venue}&week=${day}`;

/** One day on the week grid (the phone list is in the page too, hidden). */
const weekDay = (page: Page, day: string) =>
  page.locator(`[data-view="week"] li[data-day="${day}"]`);

/** The stretches one day is split into, in order, as spoken: [kind, words]. */
async function stretches(page: Page, day: string) {
  return weekDay(page, day)
    .locator("li[data-kind]")
    .evaluateAll((lis) =>
      lis.map((li) => [
        li.getAttribute("data-kind"),
        li.querySelector("[data-summary]")?.textContent?.trim() ?? "",
      ]),
    );
}

async function recordMaintenance(
  page: Page,
  start: string,
  end: string,
  reason = "Maintenance",
) {
  await page.goto(calendarFor(AUDITORIUM, start.split("T")[0]));
  await page.locator('[data-hydrated="true"]').waitFor();
  await page.getByRole("button", { name: "Record unavailability" }).click();
  await setTime(page, "Start", start);
  await setTime(page, "End", end);
  await choose(page, "Reason", reason);
  await page
    .getByRole("button", { name: "Record unavailability" })
    .last()
    .click();
}

/** Fill the request form; what the live check says is left to the caller. */
async function requestAuditorium(page: Page, event: string) {
  await page.goto("/bookings/new");
  await page.locator('[data-hydrated="true"]').waitFor();
  await choose(page, "Event", event);
  await choose(page, "Room layout", /^theatre$/);
  await choose(page, "Venue", /^Grand Auditorium/);
}

test.describe("SCRUM-36 / SCRUM-37 — venue availability calendar and recorded unavailability", () => {
  // Two users, the calendar paged out to 2036, and several round trips.
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(async () => {
    if (!usesLocalDatabase) return;
    await removeTestEvents();
    const event = (name: string, start: string, end: string, day = DAY) => ({
      name,
      status: "PLANNING" as const,
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      startAt: new Date(`${day}T${start}:00+08:00`),
      endAt: new Date(`${day}T${end}:00+08:00`),
      expectedAttendance: 100,
      preferredLayout: "theatre",
    });
    await prisma.event.createMany({
      data: [
        event(CLASHING_EVENT, "14:00", "16:00"),
        event(MORNING_EVENT, "09:00", "13:00"),
        event(ELSEWHERE_EVENT, "10:00", "12:00"),
        event(FLAGGED_EVENT, "09:00", "13:00", FLAGGED_DAY),
      ],
    });
  });

  test.afterAll(async () => {
    if (usesLocalDatabase) await removeTestEvents();
  });

  test.beforeEach(async () => {
    if (!usesLocalDatabase) return;
    const since = { gte: new Date("2036-01-01T00:00:00.000Z") };
    const bookings = await prisma.booking.findMany({
      where: { venueId: AUDITORIUM, startAt: since },
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
    await prisma.venueUnavailability.deleteMany({
      where: { venueId: AUDITORIUM, startAt: since },
    });
  });

  test("SCRUM-37 [AC1, AC2, AC5], SCRUM-36 [AC2, AC3, AC5]: maintenance is recorded, seen, refused over, and sat flush against a booking", async ({
    browser,
  }, testInfo) => {
    test.skip(!usesLocalDatabase, "creates its own events");
    const staff = await signedIn(browser, "venuestaff@test.local");
    const coordinator = await signedIn(browser, "coordinator@test.local");

    // SCRUM-37 AC1 — Venue Staff record maintenance with a period and a reason.
    await recordMaintenance(staff, `${DAY}T13:00`, `${DAY}T17:00`);
    await expect(
      staff.getByText(
        "Recorded: Grand Auditorium is unavailable for that period.",
      ),
    ).toBeVisible();

    // SCRUM-36 AC3 — the Coordinator sees it as unavailable, labelled as
    // maintenance rather than a booking.
    await coordinator.goto(calendarFor(AUDITORIUM, DAY));
    expect(await stretches(coordinator, DAY)).toEqual([
      ["free", "Available midnight to 1:00 pm SGT"],
      [
        "unavailability",
        "Unavailable (maintenance) 1:00 pm SGT to 5:00 pm SGT",
      ],
      ["free", "Available 5:00 pm SGT to midnight"],
    ]);

    // SCRUM-37 AC2 — a request over it is refused, like a booking clash.
    await requestAuditorium(coordinator, CLASHING_EVENT);
    await expect(coordinator.getByTestId("live-availability")).toContainText(
      "Grand Auditorium is unavailable for this period: unavailable (maintenance) from 10 Jan 2036, 1:00 pm SGT to 10 Jan 2036, 5:00 pm SGT.",
    );
    await expect(
      coordinator.getByRole("button", { name: "Submit request" }),
    ).toBeDisabled();

    // SCRUM-37 AC5 — a request ending exactly as the maintenance begins is accepted.
    await requestAuditorium(coordinator, MORNING_EVENT);
    await expect(coordinator.getByTestId("live-availability")).toHaveAttribute(
      "data-state",
      "free",
    );
    await coordinator.getByRole("button", { name: "Submit request" }).click();
    await expect(coordinator.getByTestId("booking-success")).toContainText(
      "Request submitted",
    );
    await coordinator.getByRole("button", { name: "Done" }).click();

    // Staff approve it.
    await staff.goto("/bookings");
    const card = await openBooking(staff, MORNING_EVENT);
    await expect(card).toContainText(
      "10 Jan 2036, 9:00 am SGT to 10 Jan 2036, 1:00 pm SGT",
    );
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(staff.getByText(/^Approved: Grand Auditorium/)).toBeVisible();

    // SCRUM-36 AC2 / AC5 — the approved booking is on the
    // calendar at once, flush against the maintenance: no gap between them.
    await coordinator.goto(calendarFor(AUDITORIUM, DAY));
    expect(await stretches(coordinator, DAY)).toEqual([
      ["free", "Available midnight to 9:00 am SGT"],
      ["booking", "Booked 9:00 am SGT to 1:00 pm SGT"],
      [
        "unavailability",
        "Unavailable (maintenance) 1:00 pm SGT to 5:00 pm SGT",
      ],
      ["free", "Available 5:00 pm SGT to midnight"],
    ]);

    // Tall enough to show the whole working day in the screenshots.
    await coordinator.setViewportSize({ width: 1280, height: 1100 });
    const shot = await coordinator.screenshot({ fullPage: false });
    await testInfo.attach("SCRUM-36 booking and maintenance side by side", {
      body: shot,
      contentType: "image/png",
    });
    if (process.env.EVIDENCE_DIR) {
      await coordinator.screenshot({
        path: `${process.env.EVIDENCE_DIR}/SCRUM-36-booking-and-maintenance.png`,
      });
    }

    // SCRUM-36 — hovering a booking or unavailability shows its details.
    const booking = weekDay(coordinator, DAY).locator(
      'li[data-kind="booking"]',
    );
    await booking.hover();
    const bookingDetails = booking.getByRole("tooltip");
    await expect(bookingDetails).toBeVisible();
    await expect(bookingDetails).toContainText(MORNING_EVENT);
    await expect(bookingDetails).toContainText("Requested by Cody Coordinator");
    await expect(bookingDetails).toContainText("100 expected");
    // A screen reader hears the same details as the block's description.
    await expect(
      booking.getByRole("button", {
        name: "Booked 9:00 am SGT to 1:00 pm SGT",
      }),
    ).toHaveAccessibleDescription(/Requested by Cody Coordinator/);
    await testInfo.attach("SCRUM-36 details shown on hover", {
      body: await coordinator.screenshot({ fullPage: false }),
      contentType: "image/png",
    });
    if (process.env.EVIDENCE_DIR) {
      await coordinator.screenshot({
        path: `${process.env.EVIDENCE_DIR}/SCRUM-36-hover-details.png`,
      });
    }

    const maintenance = weekDay(coordinator, DAY).locator(
      'li[data-kind="unavailability"]',
    );
    await maintenance.hover();
    await expect(maintenance.getByRole("tooltip")).toContainText(
      "Recorded by Vera Venue",
    );
    await expect(bookingDetails).toBeHidden();
  });

  test("SCRUM-161 [AC1-AC4] TC-161-01, TC-161-04, TC-161-06, TC-161-16: unavailability over an approved booking, on quarter hours, is confirmed, saved, flags the booking and tells its Coordinator", async ({
    browser,
  }) => {
    test.skip(!usesLocalDatabase, "creates its own events");
    const { id: eventId } = await prisma.event.findFirstOrThrow({
      where: { name: FLAGGED_EVENT },
      select: { id: true },
    });
    const booked = await prisma.booking.create({
      data: {
        eventId,
        venueId: AUDITORIUM,
        startAt: new Date(`${FLAGGED_DAY}T09:00:00+08:00`),
        endAt: new Date(`${FLAGGED_DAY}T13:00:00+08:00`),
        status: "APPROVED",
        requestedById: "usr_coordinator",
        decidedById: "usr_venuestaff",
        decidedAt: new Date(),
      },
    });
    const recordedThatDay = () =>
      prisma.venueUnavailability.count({
        where: {
          venueId: AUDITORIUM,
          startAt: { gte: new Date(`${FLAGGED_DAY}T00:00:00+08:00`) },
        },
      });
    const staff = await signedIn(browser, "venuestaff@test.local");

    // AC1, AC2 — the overlap doesn't refuse it; the booking is shown first.
    // TC-161-16: times needn't fall on a half hour.
    await recordMaintenance(
      staff,
      `${FLAGGED_DAY}T10:15`,
      `${FLAGGED_DAY}T11:45`,
      "Equipment failure",
    );
    const affected = staff.getByTestId("affected-booking");
    await expect(affected).toHaveCount(1);
    await expect(affected).toContainText(FLAGGED_EVENT);
    await expect(affected).toContainText("Coordinator: Cody Coordinator");
    await expect(affected).toContainText("Approved");
    expect(await recordedThatDay()).toBe(0);

    await staff
      .getByRole("button", { name: "Record and flag 1 booking" })
      .click();
    await expect(
      staff.getByText(
        "Recorded: Grand Auditorium is unavailable for that period. 1 booking flagged for their Coordinators.",
      ),
    ).toBeVisible();
    expect(await recordedThatDay()).toBe(1);

    // AC3 — flagged with the reason and period, and otherwise untouched.
    expect(
      await prisma.booking.findUniqueOrThrow({ where: { id: booked.id } }),
    ).toMatchObject({
      status: "APPROVED",
      startAt: booked.startAt,
      endAt: booked.endAt,
      needsReconsideration: true,
      reconsiderationReason:
        "Grand Auditorium is unavailable: Equipment failure from 12 Jan 2036, 10:15 am SGT to 12 Jan 2036, 11:45 am SGT.",
    });

    // AC4 — the Coordinator is told alternative arrangements are required.
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto("/notifications");
    const notice = coordinator
      .getByRole("listitem")
      .filter({ hasText: FLAGGED_EVENT });
    await expect(notice).toContainText(
      "Alternative venue arrangements required",
    );
    await expect(notice).toContainText(
      "Grand Auditorium is unavailable (Equipment failure from 12 Jan 2036, 10:15 am SGT to 12 Jan 2036, 11:45 am SGT)",
    );
  });

  test("SCRUM-36 [AC6] TC-36-04: a venue with nothing in the week reads as available throughout, not blank", async ({
    browser,
  }) => {
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto(calendarFor("ven_boardroom", "2036-06-04"));

    // Every day says so at the top of its column, rather than reading as blank.
    const freeAllDay = coordinator.locator(
      '[data-view="week"] li[data-day] [data-free-all-day]',
    );
    await expect(freeAllDay).toHaveCount(7);
    await expect(freeAllDay.first()).toHaveText("Available all day");
    await expect(
      coordinator.locator('[data-view="week"] li[data-day]'),
    ).toHaveCount(7);
    for (const day of ["2036-06-02", "2036-06-08"]) {
      expect(await stretches(coordinator, day)).toEqual([
        ["free", "Available all day"],
      ]);
    }
  });

  test("SCRUM-36 [AC1] TC-36-05: the calendar shows a week, Monday to Sunday, and moves between weeks", async ({
    browser,
  }) => {
    const coordinator = await signedIn(browser, "coordinator@test.local");
    // Fri 1 Feb 2036 is in the week of Mon 28 Jan.
    await coordinator.goto(calendarFor("ven_hall", "2036-02-01"));
    await coordinator.locator('[data-hydrated="true"]').waitFor();
    const heading = coordinator.getByRole("heading", {
      name: /Exhibition Hall/,
    });

    await expect(heading).toContainText("28 Jan 2036 to 3 Feb 2036");
    // The week's dates sit between the arrows.
    const week = coordinator.getByTestId("week-range");
    await expect(week).toHaveText("28 Jan – 3 Feb 2036");
    await expect(
      coordinator.locator('[data-view="week"] li[data-day]'),
    ).toHaveCount(7);

    await coordinator.getByRole("button", { name: "Next week" }).click();
    await expect(heading).toContainText("4 Feb 2036 to 10 Feb 2036");

    await coordinator.getByRole("button", { name: "Previous week" }).click();
    await expect(heading).toContainText("28 Jan 2036 to 3 Feb 2036");
    await coordinator.getByRole("button", { name: "Previous week" }).click();
    await expect(heading).toContainText("21 Jan 2036 to 27 Jan 2036");
    await expect(week).toHaveText("21 – 27 Jan 2036");

    // Go to date jumps straight to the week containing the chosen day.
    await coordinator.getByRole("button", { name: "Go to date" }).click();
    await coordinator.getByRole("menuitem", { name: "Next month" }).click();
    // Wed 20 Feb 2036 is in the week of Mon 18 Feb.
    await coordinator.locator('[data-date="2036-02-20"]').click();
    await expect(week).toHaveText("18 – 24 Feb 2036");
  });

  test("SCRUM-36 TC-36-06: a screen reader hears the venue and date for each day", async ({
    browser,
  }) => {
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto(calendarFor("ven_hall", "2036-02-01"));

    await expect(
      coordinator.getByRole("listitem", {
        name: "Exhibition Hall, Fri, 1 Feb 2036",
      }),
    ).toBeVisible();
  });

  test("SCRUM-36 TC-36-06: the calendar works at phone width", async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const phone = await context.newPage();
    await phone.goto("/login");
    await phone
      .getByLabel("Email", { exact: true })
      .fill("coordinator@test.local");
    await phone.getByLabel("Password", { exact: true }).fill("Password123!");
    await phone.getByRole("button", { name: "Sign in" }).click();
    await phone.waitForURL((url) => !url.pathname.startsWith("/login"));
    await phone.goto(calendarFor("ven_seminar", "2026-10-07"));

    // Nothing is wider than the screen.
    const overflow = await phone.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    // At phone width the week is a list of days, not seven columns.
    await expect(
      phone.locator('[data-view="list"] li[data-day]').first(),
    ).toBeVisible();
    await expect(phone.locator('[data-view="week"]')).toBeHidden();

    await testInfo.attach("SCRUM-36 calendar at phone width", {
      body: await phone.screenshot({ fullPage: false }),
      contentType: "image/png",
    });
    if (process.env.EVIDENCE_DIR) {
      await phone.screenshot({
        path: `${process.env.EVIDENCE_DIR}/SCRUM-36-calendar-phone-width.png`,
        fullPage: false,
      });
    }
    // The calendar refreshes itself; left open, it would load the server
    // for every later test (SCRUM-182).
    await context.close();
  });

  test("SCRUM-36 [AC2] TC-36-09: an open calendar picks up a booking approved elsewhere, without a reload", async ({
    browser,
  }) => {
    // The booking is written straight to the database, as if approved by
    // someone else, so only a local database can host this test.
    test.skip(!usesLocalDatabase, "writes to the database");
    const day = "2036-03-05";
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto(calendarFor(AUDITORIUM, day));
    await coordinator.locator('[data-hydrated="true"]').waitFor();
    const booked = weekDay(coordinator, day).locator('li[data-kind="booking"]');
    await expect(booked).toHaveCount(0);

    // Each event holds one venue (SCRUM-50 AC8), so it is this spec's own.
    const { id: eventId } = await prisma.event.findFirstOrThrow({
      where: { name: ELSEWHERE_EVENT },
      select: { id: true },
    });
    await prisma.booking.create({
      data: {
        eventId,
        venueId: AUDITORIUM,
        startAt: new Date(`${day}T10:00:00+08:00`),
        endAt: new Date(`${day}T12:00:00+08:00`),
        status: "APPROVED",
        requestedById: "usr_coordinator",
        decidedById: "usr_venuestaff",
        decidedAt: new Date(),
      },
    });

    // No reload: the calendar refreshes itself every 15 seconds.
    await expect(booked).toHaveCount(1, { timeout: 25_000 });
    await expect(booked.getByRole("button")).toHaveAccessibleName(
      "Booked 10:00 am SGT to 12:00 pm SGT",
    );
  });

  test("SCRUM-36, SCRUM-37 TC-36-07: who can see the calendar and record unavailability", async ({
    browser,
  }) => {
    for (const email of ["organiser@test.local", "techsupport@test.local"]) {
      const page = await signedIn(browser, email);
      await page.goto(calendarFor(AUDITORIUM, DAY));
      await expect(
        page.getByRole("heading", { name: "Access denied" }),
      ).toBeVisible();
    }

    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto(calendarFor(AUDITORIUM, DAY));
    await expect(
      coordinator.getByRole("heading", { name: "Venue availability" }),
    ).toBeVisible();
    await expect(
      coordinator.getByRole("button", { name: "Record unavailability" }),
    ).toHaveCount(0);
  });
});
