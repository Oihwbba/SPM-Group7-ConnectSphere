import { test, expect, type Page } from "@playwright/test";
import { formatDateTime } from "@/lib/datetime";
import { prisma } from "@/lib/db";

import { usesLocalDatabase } from "./helpers";

/**
 * SCRUM-38 — venue search in a real browser: opened from an event, from a
 * flagged booking, and on its own. Each test creates its own event in
 * November 2034, clear of anything seeded, and removes it afterwards. Results
 * come from the four seeded venues (prisma/seed.ts). Test cases:
 * docs/testing/SCRUM-38.md.
 */

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/events");
}

async function openDetails(page: Page, name: string) {
  await page
    .getByRole("row", { name: new RegExp(name) })
    .getByTestId("view-details-button")
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

/** The venues listed, by name, in order. */
async function resultNames(page: Page) {
  await expect(
    page.getByRole("heading", { name: /venues? free/ }),
  ).toBeVisible();
  return page
    .getByTestId("venue-result")
    .locator("p.font-medium")
    .allInnerTexts();
}

/** Tick or untick a filter value; the checkbox itself is visually hidden. */
const toggle = (page: Page, value: string) =>
  page.locator("label", { hasText: new RegExp(`^${value}$`) }).click();

/**
 * An event from 10:15 to 11:45 Singapore time on `day`; a booking would run
 * 10:00–12:00 (SCRUM-50 AC1). Each test uses its own day, because tests run
 * in parallel and one test's booking would take another's venue.
 */
async function planningEvent(name: string, day: string) {
  return (
    await prisma.event.create({
      data: {
        name,
        purpose: "SCRUM-38 journey",
        description: "Owned by the SCRUM-38 e2e spec.",
        status: "PLANNING",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        startAt: new Date(`${day}T10:15:00+08:00`),
        endAt: new Date(`${day}T11:45:00+08:00`),
        expectedAttendance: 40,
        submittedAt: new Date(),
      },
      select: { id: true },
    })
  ).id;
}

const bookingFor = (eventId: string, venueId: string, day: string) => ({
  eventId,
  venueId,
  startAt: new Date(`${day}T10:00:00+08:00`),
  endAt: new Date(`${day}T12:00:00+08:00`),
  requestedById: "usr_coordinator",
});

test.describe("SCRUM-38 — Search and filter venues", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  let eventId: string | undefined;

  test.afterEach(async () => {
    // An undefined id would empty the filters below and delete every booking.
    if (!eventId) return;
    await prisma.booking.deleteMany({ where: { eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
    eventId = undefined;
  });

  test("SCRUM-38 [AC1, AC2, AC8, AC9, AC14] TC-38-01, TC-38-09, TC-38-10, TC-38-14: from an event, search the event's period, keep filters as the search changes, and request a venue", async ({
    page,
  }) => {
    const name = `SCRUM-38 Search ${Date.now()}`;
    eventId = await planningEvent(name, "2034-11-07");
    // AC9: the event already asked for Seminar Room 2.1.
    await prisma.booking.create({
      data: {
        ...bookingFor(eventId, "ven_seminar", "2034-11-07"),
        status: "PENDING",
      },
    });

    await signIn(page, "coordinator@test.local");
    const details = await openDetails(page, name);
    await details.getByRole("link", { name: "Find a venue" }).click();
    await page.waitForURL(/\/venues\/search\?event=/);

    // AC1, AC2: the period is exactly the event's 10:15–11:45, not rounded,
    // with no date or time to change; only location can be added. The
    // attendance starts as the event's 40.
    const eventPeriod = `${formatDateTime(new Date("2034-11-07T10:15:00+08:00"))} to ${formatDateTime(new Date("2034-11-07T11:45:00+08:00"))}`;
    await expect(page.getByTestId("search-event")).toContainText(`For ${name}`);
    await expect(page.getByTestId("search-event")).toContainText(eventPeriod);
    for (const label of ["Start date", "Start time", "End date", "End time"]) {
      await expect(page.getByLabel(label, { exact: true })).toHaveCount(0);
    }
    await expect(page.getByLabel("Location")).toBeVisible();
    await expect(page.getByLabel("Attendance")).toHaveValue("40");
    // Dates added to the address are ignored: the period stays the event's.
    await page.goto(
      `${page.url()}&date=2034-12-25&from=08:00&endDate=2034-12-26&to=09:00`,
    );
    await expect(page.getByTestId("search-event")).toContainText(eventPeriod);
    await expect(
      page.getByRole("heading", { name: /venues? free from/ }),
    ).toContainText(eventPeriod);
    // The Executive Boardroom holds 14, under 40.
    expect(await resultNames(page)).toEqual([
      "Exhibition Hall",
      "Grand Auditorium",
      "Seminar Room 2.1",
    ]);

    // AC8: name, location and capacity.
    const auditorium = page.locator('[data-venue="ven_auditorium"]');
    await expect(auditorium).toContainText("Level 1, Block A");
    await expect(auditorium).toContainText("Capacity 500");
    // Each result links to its calendar (SCRUM-36) on the week searched.
    await expect(
      auditorium.getByRole("link", { name: "See availability" }),
    ).toHaveAttribute(
      "href",
      "/venues/availability?venue=ven_auditorium&week=2034-11-07",
    );

    // AC9: one already requested, with no second request offered.
    const seminar = page.locator('[data-venue="ven_seminar"]');
    await expect(seminar.getByTestId("already-requested")).toBeVisible();
    await expect(
      seminar.getByRole("link", { name: "Request this venue" }),
    ).toHaveCount(0);

    // AC1: a changed attendance stays changed. AC11: a facility filter.
    await page.getByLabel("Attendance").fill("20");
    await toggle(page, "projector");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/facility=projector/);
    expect(await resultNames(page)).toEqual([
      "Grand Auditorium",
      "Seminar Room 2.1",
    ]);
    await expect(page.getByLabel("Attendance")).toHaveValue("20");

    // AC14: changing the location leaves the facility filter applied.
    await page.getByLabel("Location").selectOption("Level 1, Block A");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/location=Level\+1%2C\+Block\+A/);
    expect(await resultNames(page)).toEqual(["Grand Auditorium"]);
    await expect(
      page.getByRole("checkbox", { name: "projector" }),
    ).toBeChecked();

    // AC9: Request this venue opens the form with the event and venue chosen.
    await page
      .locator('[data-venue="ven_auditorium"]')
      .getByRole("link", { name: "Request this venue" })
      .click();
    await page.waitForURL(/\/bookings\/new\?event=.*&venue=ven_auditorium/);
    await expect(
      page.getByRole("combobox", { name: "Event", exact: true }),
    ).toContainText(name);
    await expect(
      page.getByRole("combobox", { name: "Venue", exact: true }),
    ).toContainText("Grand Auditorium");
  });

  test("SCRUM-38 [AC1] TC-38-02: Find a replacement venue starts from the flagged booking request", async ({
    page,
  }) => {
    const name = `SCRUM-38 Replace ${Date.now()}`;
    eventId = await planningEvent(name, "2034-11-08");
    await prisma.booking.create({
      data: {
        ...bookingFor(eventId, "ven_hall", "2034-11-08"),
        status: "APPROVED",
        requestedAttendance: 150,
        requiredFacilities: ["sound-system"],
        requestedLayout: "theatre",
        decidedById: "usr_venuestaff",
        decidedAt: new Date(),
        needsReconsideration: true,
        reconsiderationFlaggedAt: new Date(),
        reconsiderationReason: "The event's expected attendance changed.",
      },
    });

    await signIn(page, "coordinator@test.local");
    const details = await openDetails(page, name);
    await details
      .getByTestId("reconsideration-panel")
      .getByRole("link", { name: "Find a replacement venue" })
      .click();
    await page.waitForURL(/\/venues\/search\?event=.*&replace=/);

    await expect(page.getByTestId("search-event")).toContainText(
      "Finding a replacement for Exhibition Hall",
    );
    await expect(page.getByLabel("Attendance")).toHaveValue("150");
    await expect(
      page.getByRole("checkbox", { name: "sound-system" }),
    ).toBeChecked();
    await expect(page.getByLabel("Room layout")).toHaveValue("theatre");
    // The hall is held by this very booking, so only the auditorium fits.
    expect(await resultNames(page)).toEqual(["Grand Auditorium"]);

    // The Coordinator can change what was taken from the booking.
    await toggle(page, "sound-system");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/searched=1/);
    await expect(
      page.getByRole("checkbox", { name: "sound-system" }),
    ).not.toBeChecked();
    await expect(page.getByTestId("search-event")).toContainText(
      "Finding a replacement for Exhibition Hall",
    );
  });

  test("SCRUM-38 [AC1] TC-38-18: opened from the menu, choosing an event searches for it, and None goes back", async ({
    page,
  }) => {
    const name = `SCRUM-38 Pick ${Date.now()}`;
    eventId = await planningEvent(name, "2034-11-09");

    await signIn(page, "coordinator@test.local");
    await page.goto("/venues/search");
    await expect(page.getByLabel("Start date")).toBeVisible();

    // Choosing it sends the form at once.
    await page.getByLabel("For event").selectOption({ label: name });
    await expect(page.getByTestId("search-event")).toContainText(`For ${name}`);
    await expect(page.getByLabel("Attendance")).toHaveValue("40");
    await expect(page.getByLabel("Start date")).toHaveCount(0);
    await expect(
      page
        .locator('[data-venue="ven_auditorium"]')
        .getByRole("link", { name: "Request this venue" }),
    ).toBeVisible();

    await page.getByLabel("For event").selectOption("");
    await expect(page.getByTestId("search-event")).toHaveCount(0);
    await expect(page.getByLabel("Start date")).toBeVisible();
  });

  test("SCRUM-38 [AC6, AC10] TC-38-07, TC-38-11: on its own, an invalid time range is refused, and an empty search says nothing matches", async ({
    page,
  }) => {
    await signIn(page, "coordinator@test.local");
    await page.goto("/venues/search");

    await page.getByLabel("Start date").fill("2034-11-07");
    await page.getByLabel("Start time").fill("15:00");
    await page.getByLabel("End time").fill("15:00");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/to=15%3A00/);
    await expect(
      page.getByText(
        "The time range is invalid: the end must be after the start.",
      ),
    ).toBeVisible();
    await expect(page.getByTestId("venue-result")).toHaveCount(0);
    await expect(page.getByTestId("no-venues")).toHaveCount(0);

    // AC2: the same end time on the next day is a period over two days.
    await page.getByLabel("End date").fill("2034-11-08");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/endDate=2034-11-08/);
    await expect(
      page.getByRole("heading", { name: /venues? free from/ }),
    ).toBeVisible();

    await page.getByLabel("End date").fill("");
    await page.getByLabel("End time").fill("16:00");
    // AC10: the Executive Boardroom, alone on Level 12, holds 14.
    await page.getByLabel("Location").selectOption("Level 12, Block A");
    await page.getByLabel("Attendance").fill("100");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/attendance=100/);
    await expect(page.getByTestId("no-venues")).toContainText(
      "No venues match",
    );
  });
});
