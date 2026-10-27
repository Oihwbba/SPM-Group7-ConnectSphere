import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { choose, signedIn, usesLocalDatabase, pickDateTime, openBooking } from "./helpers";

/**
 * SCRUM-50 / 52 / 53 — the venue booking journey in a real browser: a
 * Coordinator asks for a venue, Venue Staff see the request and decide, and
 * once approved the venue is unavailable for that period.
 *
 * A request is always for its event's period and attendance (SCRUM-50 AC1),
 * so this spec creates its own 2035 events on the Exhibition Hall, clear of
 * anything seeded, and removes them afterwards. It clears those bookings
 * first so a local re-run or a CI retry starts clean.
 */
const HALL = "ven_hall";
const PREFIX = "E2E Hall —";

/** Events for coordinator@test.local, by name: Singapore wall times. */
const EVENTS = {
  // Off the half hour: requested as exactly 09:10 to 12:45 (SCRUM-188 AC1).
  morning: ["Morning Lecture", "2035-03-10T09:10", "2035-03-10T12:45", 120],
  overlapping: [
    "Overlapping Talk",
    "2035-03-10T11:00",
    "2035-03-10T15:00",
    120,
  ],
  // Begins exactly when the morning's booking ends (SCRUM-50 AC4).
  afternoon: [
    "Afternoon Workshop",
    "2035-03-10T12:45",
    "2035-03-10T15:00",
    120,
  ],
  rejected: ["Exhibition Fair", "2035-05-01T09:00", "2035-05-01T12:00", 120],
  overCapacity: ["Big Concert", "2035-06-01T18:00", "2035-06-01T22:00", 250],
  atCapacity: ["Full House", "2035-06-02T18:00", "2035-06-02T22:00", 200],
  offline: ["Offline Check", "2035-07-01T09:00", "2035-07-01T11:00", 120],
  // Its dates have passed, but no venue was booked while there was time.
  past: ["Missed Seminar", "2020-01-01T09:00", "2020-01-01T11:00", 120],
} as const;
const eventName = (key: keyof typeof EVENTS) => `${PREFIX} ${EVENTS[key][0]}`;

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
  await prisma.booking.deleteMany({ where: { eventId: { in: eventIds } } });
  await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
}

async function openRequestForm(page: Page) {
  await page.goto("/bookings/new");
  await page.locator('[data-hydrated="true"]').waitFor();
}

/** Fill the form, room layout before venue, without submitting. */
async function fillHall(page: Page, event: string, notes = "") {
  await choose(page, "Event", event);
  await choose(page, "Room layout", /^theatre$/);
  await choose(page, "Venue", /^Exhibition Hall/);
  await page.getByLabel("Other details for Venue Staff").fill(notes);
}

/** Fill the form, wait for the live check to call the hall free, and submit. */
async function requestHall(page: Page, event: string, notes = "") {
  await fillHall(page, event, notes);
  await expect(page.getByTestId("live-availability")).toHaveAttribute(
    "data-state",
    "free",
  );
  await page.getByRole("button", { name: "Submit request" }).click();
}

/** SCRUM-50 AC2 — the success pop-up, dismissed; the form is then cleared. */
async function expectSubmitted(page: Page) {
  const dialog = page.getByTestId("booking-success");
  await expect(dialog).toContainText("Request submitted");
  await expect(dialog).toContainText("pending Venue Staff approval");
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel("Other details for Venue Staff")).toHaveValue(
    "",
  );
}

test.describe("SCRUM-50 / 52 / 53 — venue booking request, review and decision", () => {
  // Two users sign in and several round trips are made; these journeys need
  // more than the default 30 seconds.
  test.describe.configure({ timeout: 90_000 });

  test.beforeAll(async () => {
    if (!usesLocalDatabase) return;
    await removeTestEvents();
    await prisma.event.createMany({
      data: Object.keys(EVENTS).map((key) => {
        const [, start, end, attendance] = EVENTS[key as keyof typeof EVENTS];
        return {
          name: eventName(key as keyof typeof EVENTS),
          status: "PLANNING" as const,
          organiserId: "usr_organiser",
          coordinatorId: "usr_coordinator",
          startAt: new Date(`${start}:00+08:00`),
          endAt: new Date(`${end}:00+08:00`),
          expectedAttendance: attendance,
          // As an Organiser may have typed it; venues list "theatre".
          preferredLayout: key === "morning" ? "Theatre" : "theatre",
        };
      }),
    });
  });

  test.afterAll(async () => {
    if (usesLocalDatabase) await removeTestEvents();
  });

  test.beforeEach(async () => {
    test.skip(!usesLocalDatabase, "creates its own events");
    const rows = await prisma.booking.findMany({
      where: {
        venueId: HALL,
        startAt: { gte: new Date("2035-01-01T00:00:00.000Z") },
      },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({
      where: { entityType: "Booking", entityId: { in: rows.map((r) => r.id) } },
    });
    await prisma.booking.deleteMany({
      where: { id: { in: rows.map((r) => r.id) } },
    });
  });

  test("SCRUM-50 [AC2], SCRUM-52 [AC1-AC3], SCRUM-53 [AC1, AC4], SCRUM-207 [AC3, AC4] TC-207-06, TC-207-08: a coordinator requests, staff approve, and the venue becomes unavailable", async ({
    browser,
  }, testInfo) => {
    const tag = `e2e-journey-${testInfo.retry}`;

    // SCRUM-50 AC2 — a free period is submitted and shown as pending.
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await openRequestForm(coordinator);
    await requestHall(coordinator, eventName("morning"), tag);
    await expectSubmitted(coordinator);

    // SCRUM-162 AC2 — asking for the same venue again shows the existing
    // request instead of making a second one.
    await requestHall(coordinator, eventName("morning"));
    const existing = coordinator.getByTestId("booking-outcome");
    await expect(existing).toContainText(
      "This event already has a request for this venue.",
    );
    await expect(existing).toContainText("Exhibition Hall");
    // SCRUM-131 AC2: the booking's agreed status name.
    await expect(existing).toContainText("status Pending");

    // SCRUM-52 — staff see it with what they need to decide.
    const staff = await signedIn(browser, "venuestaff@test.local");
    await staff.goto("/bookings");
    // Change 13: the queue is a table; the request opens in its details.
    const card = await openBooking(staff, eventName("morning"));
    await expect(card).toContainText(tag);
    await expect(card).toContainText("Exhibition Hall");
    await expect(card).toContainText(
      "10 Mar 2035, 9:10 am SGT to 10 Mar 2035, 12:45 pm SGT",
    );
    await expect(card).toContainText("120 expected · venue holds 200");
    await expect(card).toContainText("Requested by Cody Coordinator");
    await expect(card).toContainText("coordinator@test.local");
    await expect(card).toContainText("Free for this period");

    // SCRUM-53 AC1 — approve.
    await card.getByRole("button", { name: "Approve" }).click();
    // Approving shows a tick and a way to the event.
    const approved = staff.getByTestId("venue-approved");
    await expect(approved).toContainText(
      /Approved: Exhibition Hall is now booked/,
    );
    await expect(approved.getByRole("button", { name: "View event" })).toBeVisible();
    await expect(card).toHaveCount(0);

    // SCRUM-53 AC4 / SCRUM-50 AC3 — an event overlapping that period now
    // finds the hall unavailable, and the form says so before submitting.
    await openRequestForm(coordinator);
    await fillHall(coordinator, eventName("overlapping"));
    const live = coordinator.getByTestId("live-availability");
    await expect(live).toHaveAttribute("data-state", "taken");
    await expect(live).toContainText(
      "Exhibition Hall is unavailable for this period: already booked from 10 Mar 2035, 9:10 am SGT to 10 Mar 2035, 12:45 pm SGT.",
    );
    await expect(
      coordinator.getByRole("button", { name: "Submit request" }),
    ).toBeDisabled();
    await testInfo.attach("SCRUM-50 refusal when the venue is already booked", {
      body: await coordinator.screenshot({ fullPage: false }),
      contentType: "image/png",
    });
    if (process.env.EVIDENCE_DIR) {
      await coordinator.screenshot({
        path: `${process.env.EVIDENCE_DIR}/SCRUM-50-venue-unavailable-refusal.png`,
        fullPage: false,
      });
    }

    // SCRUM-50 AC4 — an event beginning exactly when the booking ends is accepted.
    await choose(coordinator, "Event", eventName("afternoon"));
    await expect(live).toHaveAttribute("data-state", "free");
    await expect(live).toContainText(
      "Exhibition Hall is available for this period.",
    );
    await coordinator.getByRole("button", { name: "Submit request" }).click();
    await expectSubmitted(coordinator);
  });

  test("SCRUM-188 [AC1] TC-188-01, SCRUM-162 [AC4] TC-162-05, TC-162-06, TC-162-07: the period and attendance start from the event's, the period exactly as the event has it; a shorter period or a larger attendance disables Submit", async ({
    browser,
  }) => {
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await openRequestForm(coordinator);
    await choose(coordinator, "Event", eventName("morning"));

    const start = coordinator.getByLabel("Start", { exact: true });
    const end = coordinator.getByLabel("End", { exact: true });
    const attendance = coordinator.getByLabel("Expected attendance");
    // SCRUM-188 AC1: the event's 09:10 to 12:45, not rounded to the half hour.
    await expect(start).toHaveAttribute("data-value", "2035-03-10T09:10");
    await expect(end).toHaveAttribute("data-value", "2035-03-10T12:45");
    await expect(attendance).toHaveValue("120");
    // Its preferred layout, stored as "Theatre", is shown but not pre-selected:
    // the Coordinator chooses the layout (SCRUM-170 AC2).
    await expect(
      coordinator.getByLabel("Room layout", { exact: true }),
    ).toHaveText("No preference");
    await expect(
      coordinator.getByTestId("organiser-venue-answers"),
    ).toContainText("Theatre");
    await choose(coordinator, "Venue", /^Exhibition Hall/);
    const submit = coordinator.getByRole("button", { name: "Submit request" });
    await expect(submit).toBeEnabled();

    // A period that ends before the event does, by as little as a minute, is
    // refused, naming the event's own times (TC-162-06, TC-188-03).
    await pickDateTime(end, "2035-03-10T12:44");
    await expect(coordinator.getByTestId("short-period")).toHaveText(
      "The requested period must cover the event's whole period: 10 Mar 2035, 9:10 am SGT to 10 Mar 2035, 12:45 pm SGT.",
    );
    await expect(submit).toBeDisabled();
    // Longer than the event is fine (TC-162-05).
    await pickDateTime(end, "2035-03-10T14:00");
    await expect(coordinator.getByTestId("short-period")).toHaveCount(0);

    // Part of the event's attendance, for a breakout room, is fine; more is
    // refused (TC-162-07).
    await attendance.fill("121");
    await expect(
      coordinator.getByText(
        "The expected attendance for this venue must be from 1 to the event's 120.",
      ),
    ).toBeVisible();
    await expect(submit).toBeDisabled();
    await attendance.fill("30");
    await expect(attendance).not.toHaveAttribute("aria-invalid", "true");
    await expect(submit).toBeEnabled();
  });

  test("SCRUM-50 [AC5] TC-50-11: an event that has already started is reported before submitting, and Submit is disabled", async ({
    browser,
  }) => {
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await openRequestForm(coordinator);
    await fillHall(coordinator, eventName("past"));

    const live = coordinator.getByTestId("live-availability");
    await expect(live).toHaveAttribute("data-state", "invalid");
    await expect(live).toContainText("The start time cannot be in the past.");
    await expect(
      coordinator.getByRole("button", { name: "Submit request" }),
    ).toBeDisabled();
  });

  test("SCRUM-50 [AC3, AC4, AC5] TC-50-13: when the live check cannot answer, the form says so and leaves Submit to the server", async ({
    browser,
  }) => {
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await openRequestForm(coordinator);

    // Server actions post to the page itself; drop them while the form
    // asks about the venue, as a lost connection would.
    const action = (url: URL) => url.pathname === "/bookings/new";
    await coordinator.route(action, (route) =>
      route.request().method() === "POST" ? route.abort() : route.continue(),
    );
    await fillHall(coordinator, eventName("offline"));

    const live = coordinator.getByTestId("live-availability");
    await expect(live).toHaveAttribute("data-state", "error");
    await expect(live).toContainText(
      "Availability could not be checked right now; it will be checked again when you submit.",
    );
    const submit = coordinator.getByRole("button", { name: "Submit request" });
    await expect(submit).toBeEnabled();

    // Back online, submitting checks again and decides.
    await coordinator.unroute(action);
    await submit.click();
    await expectSubmitted(coordinator);
  });

  test("SCRUM-50 [AC1] TC-50-12: the room layout is chosen first, and only venues that support it are offered", async ({
    browser,
  }) => {
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await openRequestForm(coordinator);

    await choose(coordinator, "Room layout", /^classroom$/);
    await expect(
      coordinator.getByText(
        "Showing venues that support the classroom layout.",
      ),
    ).toBeVisible();
    await coordinator.getByLabel("Venue", { exact: true }).click();
    const offered = coordinator.getByRole("option");
    await expect(offered).toHaveCount(1);
    await expect(offered).toHaveText(/^Seminar Room 2\.1/);
    await offered.click();

    // A layout the chosen venue cannot be set up in clears it.
    await choose(coordinator, "Room layout", /^banquet$/);
    await expect(coordinator.getByLabel("Venue", { exact: true })).toHaveText(
      "Select a venue",
    );
  });

  test("SCRUM-50 TC-50-10: an event's attendance over the chosen venue's capacity is flagged, and Submit is disabled", async ({
    browser,
  }) => {
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await openRequestForm(coordinator);
    await fillHall(coordinator, eventName("overCapacity"));
    const attendance = coordinator.getByLabel("Expected attendance");
    const submit = coordinator.getByRole("button", { name: "Submit request" });

    await expect(
      coordinator.getByText(
        "Exhibition Hall holds up to 200 people; 250 expected is over its capacity.",
      ),
    ).toBeVisible();
    await expect(attendance).toHaveAttribute("aria-invalid", "true");
    await expect(submit).toBeDisabled();

    // Exactly at capacity fits.
    await choose(coordinator, "Event", eventName("atCapacity"));
    await choose(coordinator, "Venue", /^Exhibition Hall/);
    await expect(attendance).toHaveValue("200");
    await expect(coordinator.getByText(/over its capacity/)).toHaveCount(0);
    await expect(submit).toBeEnabled();
  });

  test("SCRUM-53 [AC2] TC-53-02, TC-53-03: rejecting needs a written reason, and the reason is saved", async ({
    browser,
  }, testInfo) => {
    const tag = `e2e-reject-${testInfo.retry}`;
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await openRequestForm(coordinator);
    await requestHall(coordinator, eventName("rejected"), tag);
    await expectSubmitted(coordinator);

    const staff = await signedIn(browser, "venuestaff@test.local");
    await staff.goto("/bookings");
    // SCRUM-52 — search narrows the queue to matching requests.
    const search = staff.getByLabel("Search pending requests");
    await search.fill("no-such-request-anywhere");
    await expect(staff.getByText(/^No requests match/)).toBeVisible();
    await search.fill(tag);
    await expect(staff.getByTestId("queue-row")).toHaveCount(1);
    const card = await openBooking(staff, eventName("rejected"));
    await expect(card).toContainText(tag);

    await card.getByRole("button", { name: "Reject" }).click();

    const confirm = staff.getByRole("button", { name: "Reject request" });
    await expect(confirm).toBeDisabled();
    await staff.getByLabel("Rejection reason").fill("   ");
    await expect(confirm).toBeDisabled();

    await staff
      .getByLabel("Rejection reason")
      .fill("The hall is set for an exhibition that week.");
    await confirm.click();
    await expect(staff.getByText("Rejected the request for")).toBeVisible();
    await expect(card).toHaveCount(0);

    const saved = await prisma.booking.findFirstOrThrow({
      where: { requestNotes: tag },
      select: { status: true, decisionReason: true },
    });
    expect(saved).toEqual({
      status: "REJECTED",
      decisionReason: "The hall is set for an exhibition that week.",
    });
  });

  test("SCRUM-52 TC-52-04: a coordinator typing the queue's address is refused by the server", async ({
    browser,
  }) => {
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto("/bookings");
    await expect(
      coordinator.getByRole("heading", { name: "Access denied" }),
    ).toBeVisible();
  });

  test("SCRUM-50 TC-50-09: venue staff typing the request form's address are refused by the server", async ({
    browser,
  }) => {
    const staff = await signedIn(browser, "venuestaff@test.local");
    await staff.goto("/bookings/new");
    await expect(
      staff.getByRole("heading", { name: "Access denied" }),
    ).toBeVisible();
  });
});
