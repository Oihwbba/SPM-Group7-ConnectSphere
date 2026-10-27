import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { choose, signedIn, usesLocalDatabase, selectFrom, openBooking, openReview, openEvent } from "./helpers";

/**
 * SCRUM-170 — the Organiser's answers reach the people planning the event, in
 * a real browser: the Coordinator sees them on the venue and equipment request
 * forms, which are not pre-filled from them; Venue Staff and Technical Support
 * see them on the requests they review; every event's details show them the
 * same way; and the Coordinator records No equipment needed on the readiness
 * checklist.
 *
 * The events are this spec's own, on 2037 dates clear of anything seeded, and
 * are removed afterwards with their bookings, requests and audit entries.
 */
const PREFIX = "E2E Requirements —";
const VENUE_EVENT = `${PREFIX} Awards Dinner`;
const EQUIPMENT_EVENT = `${PREFIX} Product Launch`;
const CHECKLIST_EVENT = `${PREFIX} Staff Retreat`;

const ANSWERS = {
  venueRequirements: "A hall near the lobby, with a stage",
  preferredLayout: "Banquet, round tables",
  accessibilityNeeds: "Hearing loop for the speeches",
  equipmentRequirements: "Two wireless mics and a projector",
};

async function removeTestEvents() {
  const events = await prisma.event.findMany({
    where: { name: { startsWith: PREFIX } },
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
  await prisma.notification.deleteMany({ where: { eventId: { in: ids } } });
  await prisma.booking.deleteMany({ where: { eventId: { in: ids } } });
  // Equipment requests, their lines and history cascade with the event.
  await prisma.event.deleteMany({ where: { id: { in: ids } } });
}

function planningEvent(name: string, day: string) {
  return prisma.event.create({
    data: {
      name,
      purpose: "Owned by the SCRUM-170 e2e spec.",
      status: "PLANNING",
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      startAt: new Date(`${day}T10:00:00+08:00`),
      endAt: new Date(`${day}T14:00:00+08:00`),
      expectedAttendance: 80,
      // An older request's facilities, which AC5 no longer shows.
      requiredFacilities: ["stage"],
      ...ANSWERS,
      submittedAt: new Date(),
    },
    select: { id: true, startAt: true, endAt: true },
  });
}

/** SCRUM-208: the event's page, on the tab this journey works in. */
async function openDetails(page: Page, name: string, tab = "Request") {
  return openEvent(page, name, tab);
}

test.describe("SCRUM-170 — Show the Organiser's requirements to the people planning the event", () => {
  // Serial: the tests share beforeAll's events.
  test.describe.configure({ mode: "serial", timeout: 90_000 });
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  let checklistEvent: { id: string; startAt: Date | null; endAt: Date | null };

  test.beforeAll(async () => {
    await removeTestEvents();
    await planningEvent(VENUE_EVENT, "2037-03-02");
    await planningEvent(EQUIPMENT_EVENT, "2037-03-03");
    checklistEvent = await planningEvent(CHECKLIST_EVENT, "2037-03-04");
    await prisma.booking.create({
      data: {
        eventId: checklistEvent.id,
        venueId: "ven_auditorium",
        startAt: checklistEvent.startAt!,
        endAt: checklistEvent.endAt!,
        status: "APPROVED",
        requestedAttendance: 80,
        requestedById: "usr_coordinator",
        decidedById: "usr_venuestaff",
        decidedAt: new Date(),
      },
    });
  });
  test.afterAll(async () => {
    await removeTestEvents();
  });

  test("SCRUM-170 [AC2, AC5] TC-170-01, TC-170-02, TC-170-05: the Coordinator sees the Organiser's venue answers on the request form without them being pre-filled, Venue Staff see them on the request, and the event's details show them without Required Facilities", async ({
    browser,
  }) => {
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto("/bookings/new");
    await coordinator.locator('[data-hydrated="true"]').waitFor();
    await choose(coordinator, "Event", VENUE_EVENT);

    // AC2: shown read-only, and the layout and facilities are left to the Coordinator.
    const answers = coordinator.getByTestId("organiser-venue-answers");
    await expect(answers).toContainText(ANSWERS.venueRequirements);
    await expect(answers).toContainText(ANSWERS.preferredLayout);
    await expect(answers).toContainText(ANSWERS.accessibilityNeeds);
    await expect(
      coordinator.getByLabel("Room layout", { exact: true }),
    ).toHaveText("No preference");
    await expect(
      coordinator.locator('button[aria-pressed="true"]'),
    ).toHaveCount(0);

    await choose(coordinator, "Room layout", /^banquet$/);
    await choose(coordinator, "Venue", /^Exhibition Hall/);
    await expect(coordinator.getByTestId("live-availability")).toHaveAttribute(
      "data-state",
      "free",
    );
    await coordinator.getByRole("button", { name: "Submit request" }).click();
    await expect(coordinator.getByText("Request submitted")).toBeVisible();

    // AC2: Venue Staff see the same answers on the request they review.
    const staff = await signedIn(browser, "venuestaff@test.local");
    await staff.goto("/bookings");
    const card = await openBooking(staff, VENUE_EVENT);
    await expect(card.getByTestId("organiser-venue-answers")).toContainText(
      ANSWERS.venueRequirements,
    );
    await expect(card.getByTestId("organiser-venue-answers")).toContainText(
      ANSWERS.accessibilityNeeds,
    );

    // AC5: the details view shows the answers as entered, and no Required Facilities.
    const details = await openDetails(coordinator, VENUE_EVENT);
    await expect(details.getByTestId("organiser-venue-answers")).toContainText(
      ANSWERS.preferredLayout,
    );
    await expect(
      details.getByTestId("organiser-equipment-answer"),
    ).toContainText(ANSWERS.equipmentRequirements);
    await expect(details).not.toContainText("Required Facilities");
  });

  test("SCRUM-170 [AC3] TC-170-03, TC-170-04: the Coordinator sees the Organiser's equipment answer on the request form, and Technical Support see it on the request", async ({
    browser,
  }) => {
    const event = await prisma.event.findFirstOrThrow({
      where: { name: EQUIPMENT_EVENT },
      select: { id: true },
    });
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto("/equipment-requests");
    await coordinator
      .getByRole("button", { name: "New request" })
      .first()
      .click();
    const dialog = coordinator.getByRole("dialog", {
      name: "New equipment request",
    });
    await selectFrom(dialog.getByLabel("Event"), event.id);

    await expect(
      dialog.getByTestId("organiser-equipment-answer"),
    ).toContainText(ANSWERS.equipmentRequirements);
    await selectFrom(dialog.getByLabel("Equipment type"), "eqp_projector");
    await dialog.getByLabel("Quantity").fill("1");
    await dialog.getByRole("button", { name: "Add equipment" }).click();
    await dialog.getByRole("button", { name: "Submit request" }).click();
    await expect(
      coordinator.getByText("Request submitted. It's now Pending Review."),
    ).toBeVisible();

    const tech = await signedIn(browser, "techsupport@test.local");
    await tech.goto("/equipment-requests");
    const request = await openReview(tech, EQUIPMENT_EVENT);
    await expect(
      request.getByTestId("organiser-equipment-answer"),
    ).toContainText(ANSWERS.equipmentRequirements);
  });

  test("SCRUM-170 [AC4] TC-170-06, TC-170-07, TC-170-08, SCRUM-166 [AC1]: Equipment is Not decided until the Coordinator records No equipment needed, which completes it and leaves only the safety check to request; the Organiser sees the state without who decided", async ({
    browser,
  }) => {
    const coordinator = await signedIn(browser, "coordinator@test.local");
    let details = await openDetails(coordinator, CHECKLIST_EVENT, "Arrangements");
    const equipment = details.getByTestId("readiness-item-equipment");
    await expect(equipment).toHaveAttribute("data-complete", "false");
    await expect(equipment).toContainText("Not decided");
    await expect(details.getByTestId("readiness-summary")).toHaveText(
      /Not ready to confirm yet/,
    );

    await equipment
      .getByRole("button", { name: "No equipment needed" })
      .click();
    await expect(
      coordinator.getByText("Recorded: no equipment needed."),
    ).toBeVisible();
    await expect(equipment).toHaveAttribute("data-complete", "true");
    await expect(equipment).toContainText("No equipment needed");
    await expect(equipment).toContainText("Recorded by Cody Coordinator");
    // SCRUM-166 AC1, AC9: with the venue and equipment complete, the safety
    // check is the one item left, and it can now be requested.
    await expect(details.getByTestId("readiness-summary")).toHaveText(
      /Not ready to confirm yet/,
    );
    await expect(details.getByTestId("readiness-item-safety")).toContainText(
      "Not requested",
    );
    await expect(
      details.getByRole("button", { name: "Request safety check" }),
    ).toBeVisible();

    const organiser = await signedIn(browser, "organiser@test.local");
    details = await openDetails(organiser, CHECKLIST_EVENT, "Arrangements");
    const seen = details.getByTestId("readiness-item-equipment");
    await expect(seen).toContainText("No equipment needed");
    await expect(seen).not.toContainText("Recorded by");
    await expect(
      seen.getByRole("button", { name: "No equipment needed" }),
    ).toHaveCount(0);
  });
});
