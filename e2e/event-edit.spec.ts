import { test, expect, type Page, type Route } from "@playwright/test";
import { prisma } from "@/lib/db";

import { signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-25 — editing an event's details and adding operational notes in a
 * real browser. The assigned Coordinator edits routine details (an empty name
 * is refused first), changes the attendance of an event with a venue booking,
 * which lists the booking and flags it once confirmed (SCRUM-26), and adds a
 * note; Venue Staff add one from the booking they
 * review, and Technical Support from the equipment request they review; the
 * Organiser reads them and can neither edit nor add. A note or an edit whose
 * request fails keeps what was typed and reads the event again.
 *
 * The event is this spec's own, on a 2036 date, removed afterwards with its
 * booking, equipment request and notes.
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
  await prisma.equipmentRequestUpdate.deleteMany({
    where: { request: { eventId: { in: ids } } },
  });
  await prisma.equipmentRequest.deleteMany({ where: { eventId: { in: ids } } });
  // The event's notes go with it.
  await prisma.event.deleteMany({ where: { id: { in: ids } } });
}

/** A Server Action call: a POST the page makes with a `Next-Action` header. */
function isServerAction(route: Route): boolean {
  const request = route.request();
  return request.method() === "POST" && Boolean(request.headers()["next-action"]);
}

async function openDetails(page: Page, eventName: string) {
  await page
    .getByRole("row", { name: new RegExp(eventName) })
    .getByTestId("view-details-button")
    .click();
  return page.getByRole("dialog").first();
}

test.describe("SCRUM-25 — update routine event information during planning", () => {
  // Serial: the tests share one event, and the second reads the first's note.
  test.describe.configure({ mode: "serial", timeout: 90_000 });
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

  test("SCRUM-25 [AC1, AC2, AC3, AC6] TC-25-01, TC-25-04, TC-25-06, TC-25-21, TC-25-09: the coordinator edits routine details, confirms the booking an attendance change flags and sees it flagged at once, and adds a note", async ({
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

    // AC1, AC2: a routine change saves and the status stays Planning.
    await edit.getByLabel("Event name").fill(NAME);
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

    // AC3, SCRUM-26 AC1: the venue is requested, so an attendance change
    // first lists the booking it will flag, and saves nothing until confirmed.
    await coordinator.goto("/events");
    await openDetails(coordinator, NAME);
    // The open event's details, named so a locator never lands on the edit
    // dialog, which hides them from the accessibility tree while it is open.
    const details = coordinator.getByRole("dialog", { name: NAME, exact: true });
    // Before the flag: nothing to reconsider, and the venue reads Pending.
    const flaggedPanel = details.getByTestId("reconsideration-panel");
    const venueItem = details.getByTestId("readiness-item-venue");
    await expect(venueItem).toContainText("Pending");
    await expect(flaggedPanel).toHaveCount(0);
    await details.getByRole("button", { name: "Edit details" }).click();
    await edit.getByLabel("Expected attendance").fill("150");
    await edit.getByRole("button", { name: "Save details" }).click();
    const warning = edit.getByTestId("edit-details-flag-warning");
    await expect(warning).toContainText(
      "Saving will flag these arrangements Needs Reconsideration",
    );
    await expect(warning.getByRole("listitem")).toHaveText(["Exhibition Hall (Pending)"]);
    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id: eventId } }))
        .expectedAttendance,
    ).toBe(120);

    // Back to editing leaves the form as it was, with nothing saved.
    await warning.getByRole("button", { name: "Back to editing" }).click();
    await expect(warning).toHaveCount(0);
    await expect(edit.getByLabel("Expected attendance")).toHaveValue("150");

    await edit.getByRole("button", { name: "Save details" }).click();
    await warning.getByRole("button", { name: "Save and flag" }).click();
    await expect(
      coordinator.getByText(
        "Details saved. 1 arrangement flagged Needs Reconsideration.",
      ),
    ).toBeVisible();

    // TC-25-21: the flag shows in the open event's details straight away, in
    // the panel and the readiness checklist, without reopening the event.
    await expect(edit).toHaveCount(0);
    await expect(flaggedPanel.getByTestId("flagged-booking")).toContainText(
      "Exhibition Hall (Pending)",
    );
    await expect(flaggedPanel.getByTestId("flagged-booking")).toContainText(
      "The event's expected attendance changed.",
    );
    await expect(venueItem).toContainText(
      "Needs reconsideration – The event's expected attendance changed.",
    );
    expect(
      await prisma.booking.findFirstOrThrow({
        where: { eventId },
        select: {
          status: true,
          needsReconsideration: true,
          reconsiderationReason: true,
          event: { select: { expectedAttendance: true } },
        },
      }),
    ).toEqual({
      status: "PENDING",
      needsReconsideration: true,
      reconsiderationReason: "The event's expected attendance changed.",
      event: { expectedAttendance: 150 },
    });

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

  test("SCRUM-25 [AC6] TC-25-10: technical support add a note from the equipment request they review", async ({
    browser,
  }) => {
    test.skip(!usesLocalDatabase, "creates its own event");
    const { id: requestId } = await prisma.equipmentRequest.create({
      data: {
        eventId,
        requestedById: "usr_coordinator",
        lines: { create: [{ equipmentId: "eqp_projector", quantity: 1 }] },
      },
      select: { id: true },
    });

    const tech = await signedIn(browser, "techsupport@test.local");
    await tech.goto("/equipment-requests");
    const notes = tech
      .locator(`#request-${requestId}`)
      .getByTestId("operational-notes");
    // The notes the Coordinator and Venue Staff added show here too.
    await expect(notes.getByText("Auction items arrive at 17:00.")).toBeVisible();
    await notes.getByLabel("Add a note").fill("Projector tested with the venue HDMI.");
    await notes.getByRole("button", { name: "Add note" }).click();
    await expect(notes.getByTestId("operational-note").last()).toContainText(
      "Projector tested with the venue HDMI.",
    );
    expect(
      await prisma.eventOperationalNote.findFirstOrThrow({
        where: { eventId, body: "Projector tested with the venue HDMI." },
        select: { authorId: true },
      }),
    ).toEqual({ authorId: "usr_techsupport" });
  });

  test("SCRUM-25 [AC6] TC-25-19: with the connection down, a note isn't added, the text is kept, and it can be added once the connection is back", async ({
    browser,
  }) => {
    test.skip(!usesLocalDatabase, "creates its own event");
    const NOTE = "Stage riser delivered and checked.";
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto("/events");
    const dialog = await openDetails(coordinator, NAME);
    const notes = dialog.getByTestId("operational-notes");
    await expect(notes.getByLabel("Add a note")).toBeVisible();

    // Every Server Action fails, the note and the re-read after it alike.
    await coordinator.route("**/*", (route) =>
      isServerAction(route) ? route.abort("internetdisconnected") : route.continue(),
    );
    await notes.getByLabel("Add a note").fill(NOTE);
    await notes.getByRole("button", { name: "Add note" }).click();
    await expect(notes.getByRole("alert")).toHaveText(
      "The note couldn't be added — check your connection and try again.",
    );
    await expect(notes.getByLabel("Add a note")).toHaveValue(NOTE);
    expect(
      await prisma.eventOperationalNote.count({ where: { eventId, body: NOTE } }),
    ).toBe(0);

    await coordinator.unrouteAll({ behavior: "wait" });
    await notes.getByRole("button", { name: "Add note" }).click();
    await expect(notes.getByTestId("operational-note").last()).toContainText(NOTE);
    await expect(notes.getByLabel("Add a note")).toHaveValue("");
    expect(
      await prisma.eventOperationalNote.count({ where: { eventId, body: NOTE } }),
    ).toBe(1);
  });

  test("SCRUM-25 [AC1] TC-25-20: when the reply to a save is lost after it landed, the form keeps what was typed, and saving again finds nothing to change", async ({
    browser,
  }) => {
    test.skip(!usesLocalDatabase, "creates its own event");
    const PROGRAMME = "18:30 doors, 19:00 dinner, 20:30 auction";
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto("/events");
    const dialog = await openDetails(coordinator, NAME);
    await dialog.getByRole("button", { name: "Edit details" }).click();
    const edit = coordinator.getByRole("dialog", { name: `Edit ${NAME}` });

    // The save reaches the server and is written; only the reply is lost.
    await coordinator.route("**/*", async (route) => {
      if (isServerAction(route) && route.request().postData()?.includes(PROGRAMME)) {
        await route.fetch();
        return route.abort("connectionreset");
      }
      return route.continue();
    });
    await edit.getByLabel("Programme").fill(PROGRAMME);
    await edit.getByRole("button", { name: "Save details" }).click();
    await expect(edit.getByTestId("edit-details-error")).toHaveText(
      "The details couldn't be saved — check your connection and try again.",
    );
    await expect(edit.getByLabel("Programme")).toHaveValue(PROGRAMME);
    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).programme,
    ).toBe(PROGRAMME);

    // Saving again is safe: the server compares with what it holds.
    await coordinator.unrouteAll({ behavior: "wait" });
    await edit.getByRole("button", { name: "Save details" }).click();
    await expect(coordinator.getByText("Nothing changed.")).toBeVisible();
    expect(
      await prisma.auditLog.count({
        where: { entityId: eventId, fieldName: "programme", newValue: PROGRAMME },
      }),
    ).toBe(1);
  });
});
