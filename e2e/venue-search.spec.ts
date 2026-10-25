import { test, expect, type Page } from "@playwright/test";
import { formatDateTime } from "@/lib/datetime";
import { prisma } from "@/lib/db";

import { usesLocalDatabase, pickDateTime, selectFrom } from "./helpers";

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

/**
 * AC2: pick a start or end time ("HH:mm", or "" for none) with the search's
 * time picker: hour, minute and AM or PM.
 */
async function setTime(page: Page, label: string, time: string) {
  await pickDateTime(page.getByLabel(label, { exact: true }), time);
}

/** AC2: only an hour and AM or PM, the minutes left as they start. */
async function pickHour(
  page: Page,
  label: string,
  hour: string,
  period: string,
) {
  await page.getByLabel(label, { exact: true }).click();
  const menu = page.getByRole("menu");
  await menu.locator(`[data-period="${period}"]`).click();
  await menu.locator(`[data-hour="${hour}"]`).click();
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "hidden" });
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

  test("SCRUM-38 [AC1, AC2, AC8, AC9, AC14] TC-38-01, TC-38-09, TC-38-10, TC-38-14, SCRUM-207 TC-207-23: from an event, search the event's period, keep filters as the search changes, and request a venue", async ({
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
    await expect(page.getByLabel("Date", { exact: true })).toHaveCount(0);
    for (const label of ["Start time", "End time"]) {
      await expect(page.getByLabel(label, { exact: true })).toHaveCount(0);
    }
    await expect(page.getByLabel("Location")).toBeVisible();
    await expect(page.getByLabel("Attendance")).toHaveValue("40");
    // Shared page conventions: the results wait for a search.
    await expect(page.getByTestId("venue-result")).toHaveCount(0);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/searched=1/);
    await expect(
      page.getByRole("link", { name: "Search again" }),
    ).toHaveAttribute("href", "#venue-search-form");
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
      seminar.getByRole("button", { name: "Request this venue" }),
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
    await selectFrom(page.getByLabel("Location"), "Level 1, Block A");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/location=Level\+1%2C\+Block\+A/);
    expect(await resultNames(page)).toEqual(["Grand Auditorium"]);
    await expect(
      page.getByRole("checkbox", { name: "projector" }),
    ).toBeChecked();

    // AC9: Request this venue opens the form with the event and venue chosen,
    // and what is on screen in the search: the facility searched, and a
    // layout picked without searching again.
    await selectFrom(page.getByLabel("Room layout"), "theatre");
    await page
      .locator('[data-venue="ven_auditorium"]')
      .getByRole("button", { name: "Request this venue" })
      .click();
    await page.waitForURL(/\/bookings\/new\?.*venue=ven_auditorium/);
    await expect(
      page.getByRole("combobox", { name: "Event", exact: true }),
    ).toContainText(name);
    await expect(
      page.getByRole("combobox", { name: "Venue", exact: true }),
    ).toContainText("Grand Auditorium");
    await page.locator('[data-hydrated="true"]').waitFor();
    await expect(
      page.getByRole("button", { name: "projector", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("combobox", { name: "Room layout" }),
    ).toContainText("theatre");
    // AC12: the 20 searched comes across, as a room for part of the event's
    // 40 (SCRUM-162 AC4).
    await expect(page.getByLabel("Expected attendance")).toHaveValue("20");
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
    // SCRUM-170 AC6 TC-170-13: the Organiser's answers, from a booking too.
    await expect(
      page.getByTestId("search-event").getByTestId("organiser-venue-answers"),
    ).toBeVisible();
    await expect(page.getByLabel("Attendance")).toHaveValue("150");
    await expect(
      page.getByRole("checkbox", { name: "sound-system" }),
    ).toBeChecked();
    await expect(page.locator('input[name="layout"]')).toHaveValue("theatre");
    await page.getByRole("button", { name: "Search", exact: true }).click();
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
    await expect(page.getByLabel("Date", { exact: true })).toBeVisible();

    // Choosing it sends the form at once.
    await selectFrom(page.getByLabel("For event"), { label: name });
    await expect(page.getByTestId("search-event")).toContainText(`For ${name}`);
    await expect(page.getByLabel("Attendance")).toHaveValue("40");
    await expect(page.getByLabel("Date", { exact: true })).toHaveCount(0);
    await expect(
      page
        .locator('[data-venue="ven_auditorium"]')
        .getByRole("button", { name: "Request this venue" }),
    ).toBeVisible();

    await selectFrom(page.getByLabel("For event"), "");
    await expect(page.getByTestId("search-event")).toHaveCount(0);
    await expect(page.getByLabel("Date", { exact: true })).toBeVisible();
  });

  test("SCRUM-38 [AC2, AC6, AC10] TC-38-07, TC-38-11, SCRUM-207 [AC3] TC-207-06: on its own, a search covers one day, an invalid time range is refused, and an empty search says nothing matches", async ({
    page,
  }) => {
    await signIn(page, "coordinator@test.local");
    await page.goto("/venues/search");

    // AC2: a search covers one day, so there is no end date.
    await expect(page.getByLabel("End date")).toHaveCount(0);
    await pickDateTime(page.getByLabel("Date", { exact: true }), "2034-11-07");
    await setTime(page, "Start time", "15:00");
    await setTime(page, "End time", "15:00");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/to=15%3A00/);
    await expect(
      page.getByText(
        "The time range is invalid: the end must be after the start.",
      ),
    ).toBeVisible();
    await expect(page.getByTestId("venue-result")).toHaveCount(0);
    await expect(page.getByTestId("no-venues")).toHaveCount(0);

    // AC2: a search can't run into the next day, so 18:00 to 09:00 is
    // refused too, even with an end date added to the address.
    await setTime(page, "Start time", "18:00");
    await setTime(page, "End time", "09:00");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/to=09%3A00/);
    await page.goto(`${page.url()}&endDate=2034-11-08`);
    await expect(
      page.getByText(
        "The time range is invalid: the end must be after the start.",
      ),
    ).toBeVisible();
    await expect(page.getByTestId("venue-result")).toHaveCount(0);

    await setTime(page, "Start time", "15:00");
    await setTime(page, "End time", "16:00");
    // AC10: the Executive Boardroom, alone on Level 12, holds 14.
    await selectFrom(page.getByLabel("Location"), "Level 12, Block A");
    await page.getByLabel("Attendance").fill("100");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/attendance=100/);
    await expect(page.getByTestId("no-venues")).toContainText(
      "No venues match",
    );
  });
});

test.describe("SCRUM-38 — opening hours, suitability and the Organiser's answers", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  let eventId: string | undefined;

  test.afterEach(async () => {
    if (!eventId) return;
    await prisma.event.deleteMany({ where: { id: eventId } });
    eventId = undefined;
  });

  test("SCRUM-38 [AC1, AC8, AC11, AC14] TC-38-01, TC-38-09, TC-38-12: from an event, the Organiser's answers show beside the filters, and with the filters off a venue that doesn't fit is listed as Not suitable", async ({
    page,
  }) => {
    const name = `SCRUM-38 Fit ${Date.now()}`;
    eventId = await planningEvent(name, "2034-11-14");
    await prisma.event.update({
      where: { id: eventId },
      data: {
        venueRequirements: "Somewhere near the MRT",
        preferredLayout: "Theatre",
        accessibilityNeeds: "Step-free access for two guests",
      },
    });

    await signIn(page, "coordinator@test.local");
    await page.goto(`/venues/search?event=${eventId}`);

    // AC1 (SCRUM-170 AC6): read-only, exactly as entered.
    const answers = page
      .getByTestId("search-event")
      .getByTestId("organiser-venue-answers");
    await expect(answers).toContainText("Somewhere near the MRT");
    await expect(answers).toContainText("Theatre");
    await expect(answers).toContainText("Step-free access for two guests");

    // AC11, AC12: the filters start on; the Boardroom, holding 14, is left out.
    await expect(
      page.getByRole("checkbox", { name: "Only show venues that fit" }),
    ).toBeChecked();
    await page.getByRole("button", { name: "Search", exact: true }).click();
    expect(await resultNames(page)).toEqual([
      "Exhibition Hall",
      "Grand Auditorium",
      "Seminar Room 2.1",
    ]);
    // AC8: every venue that passed the filters is Suitable, with no reasons.
    await expect(page.getByTestId("suitability-result")).toHaveText([
      "Suitable",
      "Suitable",
      "Suitable",
    ]);
    await expect(page.getByTestId("suitability-reason")).toHaveCount(0);

    // With the filters off, the Boardroom is listed and says why it doesn't fit.
    await page
      .getByRole("checkbox", { name: "Only show venues that fit" })
      .uncheck();
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/searched=1/);
    await expect(page).not.toHaveURL(/fit=1/);
    const boardroom = page.locator('[data-venue="ven_boardroom"]');
    await expect(boardroom.getByTestId("suitability-result")).toHaveText(
      "Not suitable",
    );
    await expect(boardroom.getByTestId("suitability-reason")).toHaveText([
      "Capacity 14 < attendance 40",
    ]);
    expect(await resultNames(page)).toHaveLength(4);

    // AC14: changing the attendance keeps the filters off.
    await page.getByLabel("Attendance").fill("10");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/attendance=10/);
    await expect(
      page.getByRole("checkbox", { name: "Only show venues that fit" }),
    ).not.toBeChecked();
    await expect(boardroom.getByTestId("suitability-result")).toHaveText(
      "Suitable",
    );
  });

  test("SCRUM-38 [AC4, AC15] TC-38-15, TC-38-20: on its own, a time range excludes venues not yet open, and a date alone excludes venues closed that day", async ({
    page,
  }) => {
    await signIn(page, "coordinator@test.local");
    await page.goto("/venues/search");

    // Tuesday 07:30–09:00: the Hall opens at 06:00 and the Auditorium at
    // 07:00; Seminar Room 2.1 opens at 08:00 and the Boardroom at 09:00.
    await pickDateTime(page.getByLabel("Date", { exact: true }), "2034-11-14");
    await setTime(page, "Start time", "07:30");
    await setTime(page, "End time", "09:00");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/from=07%3A30/);
    expect(await resultNames(page)).toEqual([
      "Exhibition Hall",
      "Grand Auditorium",
    ]);

    // Saturday, no times: Seminar Room 2.1 and the Boardroom are Closed.
    await pickDateTime(page.getByLabel("Date", { exact: true }), "2034-11-11");
    await setTime(page, "Start time", "");
    await setTime(page, "End time", "");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/date=2034-11-11/);
    expect(await resultNames(page)).toEqual([
      "Exhibition Hall",
      "Grand Auditorium",
    ]);

    // The Tuesday, no times: every venue is open at some point that day.
    await pickDateTime(page.getByLabel("Date", { exact: true }), "2034-11-14");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/date=2034-11-14/);
    expect(await resultNames(page)).toEqual([
      "Executive Boardroom",
      "Exhibition Hall",
      "Grand Auditorium",
      "Seminar Room 2.1",
    ]);
  });
});

test.describe("SCRUM-38 — picking times and resetting the search", () => {
  test("SCRUM-38 [AC2] TC-38-21: on its own, an hour and PM is enough for a time, and Reset clears every field, searched or not", async ({
    page,
  }) => {
    await signIn(page, "coordinator@test.local");
    await page.goto("/venues/search");

    // An hour and PM, the minutes left alone: 3 PM to 5 PM, not midnight.
    await pickDateTime(page.getByLabel("Date", { exact: true }), "2034-11-14");
    await pickHour(page, "Start time", "03", "PM");
    await pickHour(page, "End time", "05", "PM");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/from=15%3A00/);
    await expect(page).toHaveURL(/to=17%3A00/);
    // The time searched shows again as it was picked.
    await expect(page.getByLabel("End time", { exact: true })).toHaveAttribute(
      "data-value",
      "17:00",
    );
    await expect(page.getByLabel("End time", { exact: true })).toContainText(
      "5:00 pm",
    );

    // Something changed but not searched, then Reset: every field is empty.
    await toggle(page, "projector");
    await page.getByLabel("Attendance").fill("30");
    await page.getByRole("link", { name: "Reset" }).click();
    await expect(page).toHaveURL(/\/venues\/search$/);
    for (const label of ["Date", "Start time", "End time"]) {
      await expect(page.getByLabel(label, { exact: true })).toHaveAttribute(
        "data-value",
        "",
      );
    }
    await expect(page.getByLabel("Attendance")).toHaveValue("");
    await expect(
      page.getByRole("checkbox", { name: "projector" }),
    ).not.toBeChecked();

    // Typed on a search with nothing searched yet, Reset still clears it.
    await pickDateTime(page.getByLabel("Date", { exact: true }), "2034-11-15");
    await pickHour(page, "Start time", "09", "AM");
    await page.getByRole("link", { name: "Reset" }).click();
    for (const label of ["Date", "Start time"]) {
      await expect(page.getByLabel(label, { exact: true })).toHaveAttribute(
        "data-value",
        "",
      );
    }
  });
});
