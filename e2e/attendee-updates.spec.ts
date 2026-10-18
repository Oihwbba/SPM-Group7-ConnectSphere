import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

import { signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-85 — an event an Attendee registered for goes back to Planning with a
 * new date, then is confirmed again. The spec writes its own event, as a
 * flagged venue (SCRUM-26) or a change request (SCRUM-128) would leave it,
 * and removes it afterwards.
 */
const PREFIX = "E2E Attendee Updates —";
const CONFIRMED = {
  startAt: new Date("2038-09-07T10:00:00+08:00"),
  endAt: new Date("2038-09-07T13:00:00+08:00"),
};
const MOVED = {
  startAt: new Date("2038-09-14T10:00:00+08:00"),
  endAt: new Date("2038-09-14T13:00:00+08:00"),
};

async function removeTestEvents() {
  const ids = (
    await prisma.event.findMany({
      where: { name: { startsWith: PREFIX } },
      select: { id: true },
    })
  ).map((e) => e.id);
  await prisma.safetyCheck.deleteMany({ where: { eventId: { in: ids } } });
  await prisma.registration.deleteMany({ where: { eventId: { in: ids } } });
  await prisma.notification.deleteMany({ where: { eventId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
  await prisma.booking.deleteMany({ where: { eventId: { in: ids } } });
  await prisma.event.deleteMany({ where: { id: { in: ids } } });
}

test.describe("SCRUM-85 — Attendees are kept informed", () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(!usesLocalDatabase, "writes its own event; local database only");

  test.beforeAll(async () => {
    if (usesLocalDatabase) await removeTestEvents();
  });

  test.afterAll(async () => {
    if (usesLocalDatabase) await removeTestEvents();
  });

  test("SCRUM-85 [AC2, AC7, AC8, AC9, AC10, AC11] TC-85-02, TC-85-06, TC-85-07, TC-85-08: while re-planned the Attendee sees what was last confirmed; once confirmed with a new date they are told and the event is back", async ({
    browser,
  }) => {
    const name = `${PREFIX} Garden Party ${Date.now()}`;
    const event = await prisma.event.create({
      data: {
        name,
        description: "A summer evening in the garden.",
        status: "PLANNING",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        ...MOVED,
        expectedAttendance: 20,
        registrationRequired: true,
        registrationEnabled: true,
        noEquipmentNeededAt: new Date(),
        noEquipmentNeededById: "usr_coordinator",
        confirmedStartAt: CONFIRMED.startAt,
        confirmedEndAt: CONFIRMED.endAt,
        confirmedVenues: ["Seminar Room 2.1 — Level 2, Block B"],
      },
      select: { id: true },
    });
    await prisma.booking.create({
      data: {
        eventId: event.id,
        venueId: "ven_seminar",
        ...MOVED,
        status: "APPROVED",
        requestedById: "usr_coordinator",
        decidedById: "usr_venuestaff",
        decidedAt: new Date(),
      },
    });
    await prisma.safetyCheck.create({
      data: {
        eventId: event.id,
        status: "APPROVED",
        requestedById: "usr_coordinator",
        decidedById: "usr_safetyofficer",
        decidedAt: new Date(),
      },
    });
    await prisma.registration.create({
      data: { eventId: event.id, userId: "usr_attendee_4", status: "REGISTERED" },
    });

    // AC8: My Registrations says it is being updated, never "Planning", with
    // the date last confirmed.
    const attendee = await signedIn(browser, "attendee4@test.local");
    await attendee.goto("/registrations");
    const card = attendee
      .getByTestId("registration-card")
      .filter({ hasText: name });
    await expect(card.getByTestId("registration-status")).toHaveText(
      "Details being updated – registration paused",
    );
    await expect(card.getByTestId("event-date")).toContainText(/7 Sept? 2038/);
    await expect(card).not.toContainText("Planning");

    // AC9: opening it shows what was last confirmed, not the internal plan.
    await card.getByRole("link", { name }).click();
    const replanning = attendee.getByTestId("replanning-event");
    await expect(replanning).toContainText("A summer evening in the garden.");
    await expect(replanning.getByTestId("event-date")).toContainText(/7 Sept? 2038/);
    await expect(replanning.getByTestId("venue")).toHaveText(
      "Seminar Room 2.1 — Level 2, Block B",
    );

    // AC10: it isn't listed to browse while re-planned.
    await attendee.goto("/events");
    await expect(
      attendee.getByTestId("browsable-event-card").filter({ hasText: name }),
    ).toHaveCount(0);

    // The Coordinator confirms it again, on the new date.
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto("/events");
    await coordinator
      .getByRole("row", { name: new RegExp(name) })
      .getByTestId("view-details-button")
      .click();
    await coordinator
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm event" })
      .click();
    await expect(coordinator.getByText("Event confirmed.")).toBeVisible();

    // AC2, AC7, AC11: the Attendee is told the new date, and the notice opens
    // the event, which reads as normal again.
    await attendee.goto("/notifications");
    const notice = attendee.getByText(
      "An event you registered for has changed",
    );
    await expect(notice).toBeVisible();
    await expect(attendee.getByText(/14 Sept? 2038/).first()).toBeVisible();
    await attendee.goto("/registrations");
    await expect(
      attendee
        .getByTestId("registration-card")
        .filter({ hasText: name })
        .getByTestId("registration-status"),
    ).toHaveText("Registered");
    await attendee.goto(`/events/${event.id}`);
    await expect(attendee.getByTestId("replanning-event")).toHaveCount(0);
    await expect(attendee.getByTestId("already-registered")).toBeVisible();
  });
});
