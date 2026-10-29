import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

import { signedIn, usesLocalDatabase, openEvent } from "./helpers";

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
      data: { eventId: event.id, userId: "usr_attendee_2", status: "REGISTERED" },
    });

    // AC8: My Registrations says it is being updated, never "Planning", with
    // the date last confirmed.
    const attendee = await signedIn(browser, "attendee2@test.local");
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
    await card.getByRole("link", { name: "View event" }).click();
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
    // SCRUM-208: Confirm is in the checklist, on the Arrangements tab.
    await (await openEvent(coordinator, name, "Arrangements"))
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

  test("SCRUM-85 [AC9] TC-85-07: withdrawing from the re-planned page takes the Attendee to My Registrations, showing it Withdrawn", async ({
    browser,
  }) => {
    const name = `${PREFIX} Book Club ${Date.now()}`;
    const event = await prisma.event.create({
      data: {
        name,
        status: "PLANNING",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        ...MOVED,
        expectedAttendance: 20,
        registrationRequired: true,
        registrationEnabled: true,
        confirmedStartAt: CONFIRMED.startAt,
        confirmedEndAt: CONFIRMED.endAt,
        confirmedVenues: ["Seminar Room 2.1 — Level 2, Block B"],
      },
      select: { id: true },
    });
    await prisma.registration.create({
      data: { eventId: event.id, userId: "usr_attendee_2", status: "REGISTERED" },
    });

    const attendee = await signedIn(browser, "attendee2@test.local");
    await attendee.goto(`/events/${event.id}`);
    await attendee.getByTestId("withdraw-button").click();
    // SCRUM-212 AC2, SCRUM-207 AC5: asked first in the shared dialog.
    await attendee
      .getByTestId("withdraw-dialog")
      .getByRole("button", { name: "Withdraw", exact: true })
      .click();

    await attendee.waitForURL("**/registrations");
    await expect(
      attendee
        .getByTestId("registration-card")
        .filter({ hasText: name })
        .getByTestId("registration-status"),
    ).toHaveText("Withdrawn");
  });

  test("SCRUM-85 [AC1, AC7] TC-85-01, TC-85-08: registering through the page sends a notice confirming it, which opens the event", async ({
    browser,
  }) => {
    const name = `${PREFIX} Open Mic ${Date.now()}`;
    const event = await prisma.event.create({
      data: {
        name,
        status: "CONFIRMED",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        ...CONFIRMED,
        expectedAttendance: 20,
        registrationRequired: true,
        registrationEnabled: true,
        confirmedStartAt: CONFIRMED.startAt,
        confirmedEndAt: CONFIRMED.endAt,
      },
      select: { id: true },
    });

    const attendee = await signedIn(browser, "attendee2@test.local");
    await attendee.goto(`/events/${event.id}`);
    await attendee.getByTestId("register-button").click();
    await expect(attendee.getByTestId("already-registered")).toBeVisible();

    await attendee.goto("/notifications");
    const notice = attendee
      .getByTestId("notification")
      .filter({ hasText: name });
    await expect(notice).toContainText("You're registered");
    await notice.click();
    await attendee.waitForURL(`**/events/${event.id}`);
  });

  test("SCRUM-85 [AC5, AC7, AC9, AC10] TC-85-07, TC-85-08: an event being re-planned is a 404 to an Attendee not registered for it, and a withdrawn Attendee's old notice no longer links to it", async ({
    browser,
  }) => {
    const name = `${PREFIX} Film Night ${Date.now()}`;
    const event = await prisma.event.create({
      data: {
        name,
        status: "PLANNING",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        ...MOVED,
        expectedAttendance: 20,
        registrationRequired: true,
        registrationEnabled: true,
        confirmedStartAt: CONFIRMED.startAt,
        confirmedEndAt: CONFIRMED.endAt,
        confirmedVenues: ["Seminar Room 2.1 — Level 2, Block B"],
      },
      select: { id: true },
    });
    // attendee2 registered while it was Confirmed, then withdrew.
    await prisma.registration.create({
      data: {
        eventId: event.id,
        userId: "usr_attendee_2",
        status: "WITHDRAWN",
        withdrawnAt: new Date(),
      },
    });
    await prisma.notification.create({
      data: {
        userId: "usr_attendee_2",
        type: "REGISTRATION_CONFIRMED",
        title: "You're registered",
        message: `You're registered for "${name}".`,
        eventId: event.id,
      },
    });

    // Never registered: the URL reads as missing (SCRUM-68 parity).
    const stranger = await signedIn(browser, "attendee@test.local");
    expect((await stranger.goto(`/events/${event.id}`))?.status()).toBe(404);

    // Withdrawn: the page is a 404 too, and the old notice no longer opens it.
    const withdrawn = await signedIn(browser, "attendee2@test.local");
    expect((await withdrawn.goto(`/events/${event.id}`))?.status()).toBe(404);
    await withdrawn.goto("/notifications");
    const notice = withdrawn.getByTestId("notification").filter({ hasText: name });
    await expect(notice).toContainText("You're registered");
    // The arrow is shown only for a notice that opens something.
    await expect(notice.locator("svg.lucide-chevron-right")).toHaveCount(0);
  });
});
