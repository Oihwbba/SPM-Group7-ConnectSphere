import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-25 — editing an event's details and adding operational notes in a
 * real browser. The assigned Coordinator edits routine details (an empty name
 * is refused first), is refused a change of attendance once the event has a
 * venue booking, and adds a note; Venue Staff add one from the booking they
 * review; the Organiser reads both and can neither edit nor add.
 *
 * The event is this spec's own, on a 2036 date, removed afterwards with its
 * booking and notes.
 */
const NAME = "E2E Edit — Charity Gala";

async function removeTestEvents() {
  const events = await prisma.event.findMany({
    where: { name: { startsWith: "E2E Edit —" } },
    select: { id: true },
  });
  const ids = events.map((e) => e.id);
  const bookings = await prisma.booking.findMany({
    where: { eventId: { in: ids } },
    select: { id: true },
  });
  await prisma.auditLog.deleteMany({
    where: { entityId: { in: [...ids, ...bookings.map((b) => b.id)] } },
  });
  await prisma.booking.deleteMany({ where: { eventId: { in: ids } } });
  // The event's notes go with it.
  await prisma.event.deleteMany({ where: { id: { in: ids } } });
}

async function openDetails(page: Page, eventName: string) {
  await page
    .getByRole("row", { name: new RegExp(eventName) })
    .getByTestId("view-details-button")
    .click();
  return page.getByRole("dialog").first();
}

test.describe("SCRUM-25 — update routine event information during planning", () => {
  test.describe.configure({ timeout: 90_000 });
  let eventId: string;

  test.beforeAll(async () => {
    if (!usesLocalDatabase) return;
    await removeTestEvents();
    const event = await prisma.event.create({
      data: {
        name: NAME,
        purpose: "Fundraising",
        status: "PLANNING",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        startAt: new Date("2036-07-01T10:00:00+08:00"),
        endAt: new Date("2036-07-01T14:00:00+08:00"),
        expectedAttendance: 120,
        venueRequirements: "Hall",
        preferredLayout: "banquet",
        submittedAt: new Date(),
      },
      select: { id: true },
    });
    eventId = event.id;
    await prisma.booking.create({
      data: {
        eventId,
        venueId: "ven_hall",
        startAt: new Date("2036-07-01T10:00:00+08:00"),
        endAt: new Date("2036-07-01T14:00:00+08:00"),
        status: "PENDING",
        requestedAttendance: 120,
        requestedById: "usr_coordinator",
      },
    });
  });
  test.afterAll(async () => {
    if (usesLocalDatabase) await removeTestEvents();
  });

  test("SCRUM-25 [AC1, AC2, AC3, AC6] TC-25-01, TC-25-04, TC-25-06, TC-25-09: the coordinator edits routine details, is refused an attendance change while the venue is requested, and adds a note", async ({
    browser,
  }) => {
    test.skip(!usesLocalDatabase, "creates its own event");
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto("/events");
    let dialog = await openDetails(coordinator, NAME);

    await dialog.getByRole("button", { name: "Edit details" }).click();
    const edit = coordinator.getByRole("dialog", { name: `Edit ${NAME}` });

    // A name is still required.
    await edit.getByLabel("Event name").fill("");
    await edit.getByRole("button", { name: "Save details" }).click();
    await expect(edit.getByTestId("edit-details-error")).toHaveText(
      "Please fix the highlighted fields.",
    );

    // AC3: the venue is requested, so the attendance can't change.
    await edit.getByLabel("Event name").fill(NAME);
    await edit.getByLabel("Expected attendance").fill("150");
    await edit.getByRole("button", { name: "Save details" }).click();
    await expect(edit.getByTestId("edit-details-error")).toHaveText(
      "Expected attendance can't be changed while the event has a venue booking or an equipment reservation: it would leave them out of date. Nothing was saved.",
    );

    // AC1, AC2: a routine change saves and the status stays Planning.
    await edit.getByLabel("Expected attendance").fill("120");
    await edit.getByLabel("Programme").fill("19:00 dinner, 20:30 auction");
    await edit.getByRole("button", { name: "Save details" }).click();
    await expect(coordinator.getByText("Details saved.")).toBeVisible();
    expect(
      await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { status: true, programme: true, expectedAttendance: true },
      }),
    ).toEqual({
      status: "PLANNING",
      programme: "19:00 dinner, 20:30 auction",
      expectedAttendance: 120,
    });
    expect(
      (await prisma.booking.findFirstOrThrow({ where: { eventId } }))
        .needsReconsideration,
    ).toBe(false);

    // AC6: an operational note, shown with its author.
    await coordinator.goto("/events");
    dialog = await openDetails(coordinator, NAME);
    const notes = dialog.getByTestId("operational-notes");
    await notes.getByLabel("Add a note").fill("Auction items arrive at 17:00.");
    await notes.getByRole("button", { name: "Add note" }).click();
    await expect(notes.getByTestId("operational-note")).toContainText(
      "Auction items arrive at 17:00.",
    );
  });

  test("SCRUM-25 [AC4, AC6] TC-25-07, TC-25-10, TC-25-09: venue staff add a note from the booking they review; the organiser reads the notes and can neither edit nor add", async ({
    browser,
  }) => {
    test.skip(!usesLocalDatabase, "creates its own event");
    const staff = await signedIn(browser, "venuestaff@test.local");
    await staff.goto("/bookings");
    const booking = await prisma.booking.findFirstOrThrow({
      where: { eventId },
      select: { id: true },
    });
    const card = staff.getByTestId(`booking-${booking.id}`);
    const staffNotes = card.getByTestId("operational-notes");
    await staffNotes.getByLabel("Add a note").fill("Banquet tables confirmed for 120.");
    await staffNotes.getByRole("button", { name: "Add note" }).click();
    await expect(staffNotes.getByTestId("operational-note").last()).toContainText(
      "Banquet tables confirmed for 120.",
    );

    const organiser = await signedIn(browser, "organiser@test.local");
    await organiser.goto("/events");
    const dialog = await openDetails(organiser, NAME);
    const notes = dialog.getByTestId("operational-notes");
    await expect(notes.getByText("Banquet tables confirmed for 120.")).toBeVisible();
    await expect(notes.getByLabel("Add a note")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Edit details" })).toHaveCount(0);
  });
});
