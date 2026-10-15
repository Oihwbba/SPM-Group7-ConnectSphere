import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-34 — the venue catalogue in a real browser. Venue Staff add a venue
 * (an invalid capacity and a day closing before it opens are refused first)
 * and edit it, choosing facilities, accessibility features and layouts from
 * the lists and adding ones of their own, which are then offered on the next
 * venue and on the Organiser's request form (SCRUM-13); a Coordinator reads
 * it and can't change it. Then a venue with a
 * future booking can't have its capacity lowered below it or be retired,
 * and once the booking is gone it is retired and leaves the catalogue.
 *
 * The venues and events are this spec's own, removed afterwards.
 */
const PREFIX = "E2E Venue —";

async function removeTestVenues() {
  const venues = await prisma.venue.findMany({
    where: { name: { startsWith: PREFIX } },
    select: { id: true },
  });
  const venueIds = venues.map((v) => v.id);
  const events = await prisma.event.findMany({
    where: { name: { startsWith: PREFIX } },
    select: { id: true },
  });
  const eventIds = events.map((e) => e.id);
  await prisma.booking.deleteMany({ where: { venueId: { in: venueIds } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...venueIds, ...eventIds] } } });
  await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
  await prisma.venue.deleteMany({ where: { id: { in: venueIds } } });
}

async function openVenue(page: Page, name: string) {
  await page.goto("/venues");
  await page.getByRole("link", { name, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
}

test.describe("SCRUM-34 — browse and maintain the venue catalogue", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  test.beforeAll(async () => {
    if (usesLocalDatabase) await removeTestVenues();
  });
  test.afterAll(async () => {
    if (usesLocalDatabase) await removeTestVenues();
  });

  test("SCRUM-34 [AC1, AC2, AC3, AC4, AC6, AC9] TC-34-01, TC-34-03, TC-34-05, TC-34-07, TC-34-11: venue staff add and edit a venue; a coordinator reads it and can't change it", async ({
    browser,
  }) => {
    test.skip(!usesLocalDatabase, "adds its own venue");
    const name = `${PREFIX} Rooftop Garden`;
    const staff = await signedIn(browser, "venuestaff@test.local");
    await staff.goto("/venues");
    await staff.getByRole("button", { name: "Add venue" }).click();
    const add = staff.getByRole("dialog", { name: "Add a venue" });

    await add.getByLabel("Name *").fill(name);
    await add.getByLabel("Location *").fill("Level 20, Block A");
    // AC3, AC6: chosen from the lists, plus one of each Venue Staff add.
    const facilities = add.getByRole("group", { name: "Facilities" });
    await facilities.getByRole("button", { name: "Projector", exact: true }).click();
    await facilities.getByRole("button", { name: "Sound system", exact: true }).click();
    await facilities.getByLabel("Add a facility").fill("Rooftop bar");
    await facilities.getByRole("button", { name: "Add facility" }).click();
    await expect(
      facilities.getByRole("button", { name: "Rooftop bar", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const access = add.getByRole("group", { name: "Accessibility features" });
    await access.getByRole("button", { name: "Wheelchair access", exact: true }).click();
    await access.getByLabel("Add an accessibility feature").fill("Tactile paving");
    await access.getByLabel("Add an accessibility feature").press("Enter");
    const layouts = add.getByRole("group", { name: "Supported layouts" });
    await layouts.getByRole("button", { name: "Theatre", exact: true }).click();
    await layouts.getByLabel("Add a layout").fill("Garden party");
    await layouts.getByRole("button", { name: "Add layout" }).click();
    await add.getByLabel("Known restrictions").fill("Limited emergency access");

    // AC4: capacity 0 is refused against capacity.
    await add.getByLabel("Capacity *").fill("0");
    // AC5: Tuesday closing before it opens is refused against Tuesday.
    await add.getByLabel("Tuesday opens").fill("18:00");
    await add.getByLabel("Tuesday closes").fill("09:00");
    await add.getByRole("button", { name: "Add venue" }).click();
    await expect(add.getByText("Capacity must be a whole number greater than 0.")).toBeVisible();
    await expect(add.getByLabel("Capacity *")).toHaveAttribute("aria-invalid", "true");
    await expect(add.getByText("The closing time must be after the opening time.")).toBeVisible();
    await expect(add.getByLabel("Tuesday opens")).toHaveAttribute("aria-invalid", "true");
    await expect(add.getByLabel("Monday opens")).not.toHaveAttribute("aria-invalid", "true");
    expect(await prisma.venue.count({ where: { name } })).toBe(0);

    // AC3: valid now; Sunday Closed.
    await add.getByLabel("Capacity *").fill("80");
    await add.getByLabel("Tuesday closes").fill("22:00");
    await add.getByLabel("Tuesday opens").fill("10:00");
    await add.getByLabel("Sunday closed").check();
    await add.getByRole("button", { name: "Add venue" }).click();
    await expect(staff.getByText("Venue added.")).toBeVisible();
    await expect(staff.getByRole("heading", { level: 1 })).toContainText(name);
    await expect(staff.getByTestId("opening-hours")).toContainText("Sunday");
    await expect(staff.getByTestId("opening-hours")).toContainText("Closed");

    // AC6: an edit shows at once.
    await staff.getByRole("button", { name: "Edit venue" }).click();
    const edit = staff.getByRole("dialog", { name: `Edit ${name}` });
    await edit.getByLabel("Capacity *").fill("120");
    await edit.getByRole("button", { name: "Save venue" }).click();
    await expect(staff.getByText("Venue saved.")).toBeVisible();
    await expect(staff.getByTestId("venue-details")).toContainText("120");

    // AC1, AC2, AC9: a coordinator reads every detail and can change nothing.
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await openVenue(coordinator, name);
    const details = coordinator.getByTestId("venue-details");
    await expect(details).toContainText("Level 20, Block A");
    await expect(details).toContainText("120");
    await expect(details).toContainText("0 minutes");
    await expect(details).toContainText("Limited emergency access");
    await expect(coordinator.getByTestId("opening-hours")).toContainText("10:00–22:00");
    for (const offered of [
      "projector",
      "sound system",
      "rooftop bar",
      "wheelchair access",
      "tactile paving",
      "theatre",
      "garden party",
    ]) {
      await expect(coordinator.getByText(offered, { exact: true })).toBeVisible();
    }
    for (const control of ["Add venue", "Edit venue", "Retire venue"]) {
      await expect(coordinator.getByRole("button", { name: control })).toHaveCount(0);
    }
  });

  test("SCRUM-34 [AC6] TC-34-18: what Venue Staff added is offered on the next venue and on the Organiser's request form (SCRUM-13)", async ({
    browser,
  }) => {
    test.skip(!usesLocalDatabase, "reads the venue the test above added");
    expect(
      await prisma.venue.findFirstOrThrow({
        where: { name: `${PREFIX} Rooftop Garden` },
        select: { facilities: true, accessibilityFeatures: true, supportedLayouts: true },
      }),
    ).toEqual({
      facilities: ["projector", "sound-system", "rooftop-bar"],
      accessibilityFeatures: ["wheelchair-access", "tactile-paving"],
      supportedLayouts: ["theatre", "garden-party"],
    });

    const staff = await signedIn(browser, "venuestaff@test.local");
    await staff.goto("/venues");
    await staff.getByRole("button", { name: "Add venue" }).click();
    const add = staff.getByRole("dialog", { name: "Add a venue" });
    for (const [group, option] of [
      ["Facilities", "Rooftop bar"],
      ["Accessibility features", "Tactile paving"],
      ["Supported layouts", "Garden party"],
    ]) {
      await expect(
        add.getByRole("group", { name: group }).getByRole("button", { name: option, exact: true }),
      ).toHaveAttribute("aria-pressed", "false");
    }

    // SCRUM-13: the Organiser is offered the new layout and accessibility feature.
    const organiser = await signedIn(browser, "organiser@test.local");
    await organiser.goto("/events");
    await organiser.getByRole("button", { name: /Create Event Request/i }).first().click();
    await organiser.getByLabel("Event Name *").fill(`${PREFIX} Options check`);
    await organiser.getByLabel("Event Purpose *").fill("Check the venue options.");
    await organiser.getByLabel("Event Description *").fill("SCRUM-34 AC6.");
    await organiser.getByRole("button", { name: "Next", exact: true }).click();
    await organiser.getByLabel("Proposed Start Date & Time *").fill("2036-11-01T09:00");
    await organiser.getByLabel("Proposed End Date & Time *").fill("2036-11-01T17:00");
    await organiser.getByLabel("Expected Attendance *").fill("50");
    await organiser.getByRole("button", { name: "Next", exact: true }).click();

    await organiser.getByRole("button", { name: "Garden party", exact: true }).click();
    await expect(organiser.getByLabel("Preferred Room Layout *")).toHaveValue("Garden party");
    await organiser.getByLabel("Accessibility Needs *").fill("Seats near the exit");
    await organiser.getByRole("button", { name: "Tactile paving", exact: true }).click();
    await expect(organiser.getByLabel("Accessibility Needs *")).toHaveValue(
      "Seats near the exit, Tactile paving",
    );
  });

  test("SCRUM-34 [AC8, AC10, AC11] TC-34-10, TC-34-12, TC-34-14: shrinking or retiring a venue with a future booking warns first, then flags the booking; the retired venue leaves the catalogue", async ({
    browser,
  }) => {
    test.skip(!usesLocalDatabase, "adds its own venue");
    const name = `${PREFIX} Garden Hall`;
    const venue = await prisma.venue.create({
      data: {
        name,
        location: "Level 2, Block D",
        capacity: 100,
        openingHours: {
          create: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
            weekday,
            opensMinute: 8 * 60,
            closesMinute: 22 * 60,
          })),
        },
      },
      select: { id: true },
    });
    const event = await prisma.event.create({
      data: {
        name: `${PREFIX} Spring Gala`,
        status: "PLANNING",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        startAt: new Date("2036-03-04T10:00:00+08:00"),
        endAt: new Date("2036-03-04T14:00:00+08:00"),
        expectedAttendance: 90,
      },
      select: { id: true },
    });
    const booking = await prisma.booking.create({
      data: {
        eventId: event.id,
        venueId: venue.id,
        startAt: new Date("2036-03-04T10:00:00+08:00"),
        endAt: new Date("2036-03-04T14:00:00+08:00"),
        status: "APPROVED",
        requestedAttendance: 90,
        requestedById: "usr_coordinator",
      },
      select: { id: true },
    });

    const staff = await signedIn(browser, "venuestaff@test.local");
    await openVenue(staff, name);

    // AC10: lowering capacity below the booking's attendance warns first and
    // saves nothing; confirming saves it and flags the booking.
    await staff.getByRole("button", { name: "Edit venue" }).click();
    const edit = staff.getByRole("dialog", { name: `Edit ${name}` });
    await edit.getByLabel("Capacity *").fill("60");
    await edit.getByRole("button", { name: "Save venue" }).click();
    await expect(edit.getByTestId("affected-bookings")).toContainText(
      `${PREFIX} Spring Gala`,
    );
    await expect(edit.getByTestId("affected-bookings")).toContainText("Capacity 60 < attendance 90");
    expect((await prisma.venue.findUniqueOrThrow({ where: { id: venue.id } })).capacity).toBe(100);

    await edit.getByRole("button", { name: "Save and flag 1 booking" }).click();
    await expect(
      staff.getByText("Venue saved. 1 booking flagged Needs Reconsideration."),
    ).toBeVisible();
    expect((await prisma.venue.findUniqueOrThrow({ where: { id: venue.id } })).capacity).toBe(60);
    expect(
      await prisma.booking.findUniqueOrThrow({
        where: { id: booking.id },
        select: { status: true, needsReconsideration: true },
      }),
    ).toEqual({ status: "APPROVED", needsReconsideration: true });

    // AC11: retiring it warns first, listing the booking; confirming retires
    // it and cancels nothing.
    await staff.getByRole("button", { name: "Retire venue" }).click();
    const retire = staff.getByRole("dialog", { name: `Retire ${name}?` });
    await retire.getByRole("button", { name: "Retire venue" }).click();
    await expect(retire.getByTestId("retire-error")).toContainText("Nothing is retired yet");
    await expect(retire.getByTestId("affected-bookings")).toContainText("(Approved)");
    expect((await prisma.venue.findUniqueOrThrow({ where: { id: venue.id } })).isActive).toBe(true);

    await retire.getByRole("button", { name: "Retire and flag 1 booking" }).click();
    await expect(staff.getByText(`${name} is retired.`)).toBeVisible();
    expect((await prisma.venue.findUniqueOrThrow({ where: { id: venue.id } })).isActive).toBe(false);
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status,
    ).toBe("APPROVED");
    await staff.goto("/venues");
    await expect(
      staff.getByRole("table", { name: "Retired venues" }).getByRole("link", { name }),
    ).toBeVisible();

    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto("/venues");
    await expect(coordinator.getByRole("link", { name, exact: true })).toHaveCount(0);
  });
});
