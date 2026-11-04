import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

import { openEvent, selectFrom, signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-209 — the Coordinator arranges venues, equipment and the safety check
 * from the event page's Arrangements tab, and always ends up back on it. Each
 * test writes its own Planning event straight to the database and removes
 * everything it made. Test cases: docs/testing/SCRUM-209.md.
 */
const PREFIX = "SCRUM-209 Arrange";
// Each journey on its own day, so their venues never overlap.
const DAY = {
  venue: "10",
  equipment: "11",
  safety: "12",
  readonly: "13",
  two: "14",
  reset: "15",
} as const;
const periodOn = (label: keyof typeof DAY) => ({
  startAt: new Date(`2036-03-${DAY[label]}T02:00:00Z`),
  endAt: new Date(`2036-03-${DAY[label]}T06:00:00Z`),
});

async function planningEvent(label: keyof typeof DAY, over: object = {}) {
  const name = `${PREFIX} ${label} ${Date.now()}`;
  const { id } = await prisma.event.create({
    data: {
      name,
      purpose: "Arrange from the event page",
      description: "Owned by the SCRUM-209 e2e spec.",
      status: "PLANNING",
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      ...periodOn(label),
      expectedAttendance: 40,
      preferredLayout: "Theatre",
      equipmentRequirements: "One projector",
      submittedAt: new Date(),
      ...over,
    },
    select: { id: true },
  });
  return { id, name };
}

async function approvedVenue(eventId: string, label: keyof typeof DAY) {
  await prisma.booking.create({
    data: {
      eventId,
      venueId: "ven_hall",
      ...periodOn(label),
      status: "APPROVED",
      requestedAttendance: 40,
      requestedLayout: "theatre",
      requestedById: "usr_coordinator",
      decidedById: "usr_venuestaff",
      decidedAt: new Date(),
    },
  });
}

/** Everything the event's arrangements wrote, for "nothing was written". */
async function writtenFor(eventId: string) {
  const [bookings, requests, checks, event] = await Promise.all([
    prisma.booking.count({ where: { eventId } }),
    prisma.equipmentRequest.count({ where: { eventId } }),
    prisma.safetyCheck.count({ where: { eventId } }),
    prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      select: { noEquipmentNeededAt: true },
    }),
  ]);
  return { bookings, requests, checks, noEquipment: event.noEquipmentNeededAt };
}

test.describe("SCRUM-209 — Arrange venues, equipment and the safety check from the event page", () => {
  test.describe.configure({ timeout: 120_000 });
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  test.afterAll(async () => {
    const events = await prisma.event.findMany({
      where: { name: { startsWith: PREFIX } },
      select: { id: true },
    });
    const eventIds = events.map((e) => e.id);
    const requests = await prisma.equipmentRequest.findMany({
      where: { eventId: { in: eventIds } },
      select: { id: true },
    });
    const requestIds = requests.map((r) => r.id);
    const bookings = await prisma.booking.findMany({
      where: { eventId: { in: eventIds } },
      select: { id: true },
    });
    const checks = await prisma.safetyCheck.findMany({
      where: { eventId: { in: eventIds } },
      select: { id: true },
    });
    await prisma.notification.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.auditLog.deleteMany({
      where: {
        entityId: {
          in: [
            ...eventIds,
            ...requestIds,
            ...bookings.map((b) => b.id),
            ...checks.map((c) => c.id),
          ],
        },
      },
    });
    await prisma.reservation.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.equipmentRequestUpdate.deleteMany({ where: { requestId: { in: requestIds } } });
    await prisma.equipmentRequest.deleteMany({ where: { id: { in: requestIds } } });
    await prisma.safetyCheck.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.booking.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
  });

  test("SCRUM-209 [AC1] TC-209-01, TC-209-02, TC-209-10: Find a venue, request one, and come back to the event with the new Pending booking", async ({
    browser,
  }) => {
    const { id, name } = await planningEvent("venue");
    const page = await signedIn(browser, "coordinator@test.local");
    const event = await openEvent(page, name);

    // AC5: the Next step opens Arrangements at Venues.
    await event.getByTestId("next-step").getByRole("button", { name: "Request a venue" }).click();
    const venues = event.getByTestId("readiness-item-venue");
    await expect(venues).toContainText("No venues requested yet.");

    // AC1: Find a venue opens the search for this event; Back returns.
    await venues.getByRole("link", { name: "Find a venue" }).click();
    await page.waitForURL(new RegExp(`/venues/search\\?event=${id}&return=event`));
    await expect(page.getByTestId("search-event")).toContainText(`For ${name}`);
    await page.getByRole("link", { name: "Back to the event" }).click();
    await page.waitForURL(new RegExp(`/events/${id}\\?tab=arrangements$`));
    await venues.getByRole("link", { name: "Find a venue" }).click();
    await page.waitForURL(/\/venues\/search\?/);

    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/searched=1.*return=event|return=event.*searched=1/);
    await selectFrom(page.getByLabel("Room layout"), "theatre");
    await page
      .locator('[data-venue="ven_auditorium"]')
      .getByRole("button", { name: "Request this venue" })
      .click();
    await page.waitForURL(/\/bookings\/new\?.*return=event/);
    await page.locator('[data-hydrated="true"]').waitFor();
    await expect(page.getByTestId("live-availability")).toHaveAttribute("data-state", "free");
    await page.getByRole("button", { name: "Submit request" }).click();

    // Back on the event's Arrangements, saying so, with the booking Pending.
    await page.waitForURL(new RegExp(`/events/${id}\\?tab=arrangements$`));
    await expect(
      page.getByText("Venue requested: Grand Auditorium. It is pending Venue Staff approval."),
    ).toBeVisible();
    const row = venues.getByTestId("event-venue-booking").filter({ hasText: "Grand Auditorium" });
    await expect(row).toHaveAttribute("data-status", "PENDING");
    await expect(row).toContainText("Pending");
    expect(
      await prisma.booking.findMany({ where: { eventId: id }, select: { venueId: true, status: true } }),
    ).toEqual([{ venueId: "ven_auditorium", status: "PENDING" }]);
  });

  test("SCRUM-209 [AC2] TC-209-03, TC-209-04, TC-209-10: request equipment and change a line without leaving the page; the change sends it back to Pending Review", async ({
    browser,
  }) => {
    const { id, name } = await planningEvent("equipment");
    await approvedVenue(id, "equipment");
    const page = await signedIn(browser, "coordinator@test.local");
    const event = await openEvent(page, name);

    await event.getByTestId("next-step").getByRole("button", { name: "Settle equipment" }).click();
    const equipment = event.getByTestId("readiness-item-equipment");
    await expect(equipment).toContainText("No equipment requested yet.");
    await equipment.getByRole("button", { name: "Request equipment" }).click();

    // The event is chosen already: no event dropdown in the form.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`For ${name}.`);
    await expect(dialog.getByRole("combobox", { name: "Event" })).toHaveCount(0);
    await selectFrom(dialog.getByLabel("Equipment type"), "eqp_projector");
    await dialog.getByLabel("Quantity").fill("1");
    await dialog.getByRole("button", { name: "Add equipment" }).click();
    await dialog.getByRole("button", { name: "Submit request" }).click();

    // Still on the page, with the request shown.
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/events/${id}`));
    const request = equipment.getByTestId("event-equipment-request");
    await expect(request.getByTestId("request-status")).toHaveAttribute("data-status", "PENDING_REVIEW");
    await expect(request.getByTestId("request-line")).toContainText(["Projector"]);
    await expect(equipment.getByRole("button", { name: "Request equipment" })).toHaveCount(0);

    // Technical Support approves it; a changed line sends it back for review.
    await prisma.equipmentRequest.updateMany({ where: { eventId: id }, data: { status: "APPROVED" } });
    await page.reload();
    await expect(request.getByTestId("request-status")).toHaveAttribute("data-status", "APPROVED");
    await request.getByRole("button", { name: "Change lines" }).click();
    await dialog.getByRole("button", { name: /^Remove Projector/ }).click();
    await selectFrom(dialog.getByLabel("Equipment type"), "eqp_mic");
    await dialog.getByLabel("Quantity").fill("3");
    await dialog.getByRole("button", { name: "Add equipment" }).click();
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(request.getByTestId("request-status")).toHaveAttribute("data-status", "PENDING_REVIEW");
    await expect(request.getByTestId("request-line")).toContainText(["Wireless Microphone"]);
    await expect(page).toHaveURL(new RegExp(`/events/${id}`));
    expect(
      (await prisma.equipmentRequest.findFirstOrThrow({ where: { eventId: id } })).status,
    ).toBe("PENDING_REVIEW");

    // Withdraw asks first; keeping it changes nothing.
    await request.getByRole("button", { name: "Withdraw" }).click();
    await expect(page.getByRole("dialog")).toContainText("Withdraw this equipment request?");
    await page.getByRole("button", { name: "Keep it" }).click();
    await expect(request.getByTestId("request-status")).toHaveAttribute("data-status", "PENDING_REVIEW");
  });

  test("SCRUM-209 [AC2, AC3] TC-209-05, TC-209-06, TC-209-07: No equipment needed is recorded in place; Request safety check appears only once venue and equipment are settled, and works", async ({
    browser,
  }) => {
    const { id, name } = await planningEvent("safety");
    await approvedVenue(id, "safety");
    const page = await signedIn(browser, "coordinator@test.local");
    const event = await openEvent(page, name, "Arrangements");
    const equipment = event.getByTestId("readiness-item-equipment");
    const safety = event.getByTestId("readiness-item-safety");

    // AC3: not yet allowed, so a line saying why, and no button.
    await expect(safety).toContainText("Not requested");
    await expect(safety.getByTestId("safety-check-waiting")).toHaveText(
      "Request once a venue is approved and equipment is settled.",
    );
    await expect(safety.getByRole("button", { name: "Request safety check" })).toHaveCount(0);

    // AC2: No equipment needed, without leaving the page.
    await equipment.getByRole("button", { name: "No equipment needed" }).click();
    await expect(page.getByText("Recorded: no equipment needed.")).toBeVisible();
    await expect(equipment).toContainText("No equipment needed");
    await expect(equipment).toContainText("To change this, request equipment: the request replaces it.");
    await expect(page).toHaveURL(new RegExp(`/events/${id}`));
    expect((await writtenFor(id)).noEquipment).not.toBeNull();

    // AC3: now allowed, the button appears and works.
    await expect(safety.getByTestId("safety-check-waiting")).toHaveCount(0);
    await safety.getByRole("button", { name: "Request safety check" }).click();
    await expect(safety).toContainText("Awaiting review");
    await expect(safety).toContainText("Waiting for a Safety Officer to review it.");
    await expect(safety.getByRole("button", { name: "Request safety check" })).toHaveCount(0);
    expect(
      await prisma.safetyCheck.findMany({ where: { eventId: id }, select: { status: true } }),
    ).toEqual([{ status: "AWAITING_REVIEW" }]);
  });

  test("SCRUM-209 [AC4] TC-209-08, TC-209-09: the Organiser sees the sections read-only; a Coordinator not assigned can't open it, and a direct attempt is refused with nothing written", async ({
    browser,
  }) => {
    const { id, name } = await planningEvent("readonly");
    const before = await writtenFor(id);

    const organiser = await signedIn(browser, "organiser@test.local");
    const theirs = await openEvent(organiser, name, "Arrangements");
    await expect(theirs.getByTestId("readiness-item-venue")).toContainText("No venues requested yet.");
    await expect(theirs.getByTestId("readiness-item-equipment")).toBeVisible();
    await expect(theirs.getByTestId("readiness-item-safety")).toBeVisible();
    await expect(theirs.getByTestId("readiness-checklist").getByRole("button")).toHaveCount(0);
    await expect(theirs.getByRole("link", { name: "Find a venue" })).toHaveCount(0);
    await expect(theirs.getByTestId("safety-check-waiting")).toHaveCount(0);
    // A direct attempt: the request form refuses the Organiser.
    await organiser.goto(`/bookings/new?event=${id}&venue=ven_auditorium&return=event`);
    await expect(organiser.getByRole("button", { name: "Submit request" })).toHaveCount(0);

    // Another Coordinator: the event is not found, and the request form
    // doesn't take it either.
    const other = await signedIn(browser, "coordinator2@test.local");
    expect((await other.goto(`/events/${id}?tab=arrangements`))?.status()).toBe(404);
    await other.goto(`/bookings/new?event=${id}&venue=ven_auditorium&return=event`);
    await other.locator('[data-hydrated="true"]').waitFor();
    await expect(other.getByText(name)).toHaveCount(0);
    await expect(other.getByRole("link", { name: "Back to the event" })).toHaveCount(0);

    expect(await writtenFor(id)).toEqual(before);
  });

  test("SCRUM-209 [AC2] TC-209-11, SCRUM-186 [AC5]: an event with two live equipment requests shows both, each with its own actions; withdrawing one leaves the other", async ({
    browser,
  }) => {
    const { id, name } = await planningEvent("two");
    // From before SCRUM-186: one Approved, one Pending Review.
    const request = (status: "APPROVED" | "PENDING_REVIEW", equipmentId: string) =>
      prisma.equipmentRequest.create({
        data: {
          eventId: id,
          requestedById: "usr_coordinator",
          status,
          lines: { create: [{ equipmentId, quantity: 1 }] },
        },
        select: { id: true },
      });
    const approved = await request("APPROVED", "eqp_projector");
    const pending = await request("PENDING_REVIEW", "eqp_mic");

    const page = await signedIn(browser, "coordinator@test.local");
    const event = await openEvent(page, name, "Arrangements");
    const requests = event.getByTestId("event-equipment-request");
    await expect(requests).toHaveCount(2);
    const approvedCard = event.locator(`[data-request="${approved.id}"]`);
    const pendingCard = event.locator(`[data-request="${pending.id}"]`);
    await expect(approvedCard).toContainText("Projector");
    await expect(pendingCard).toContainText("Wireless Microphone");
    for (const card of [approvedCard, pendingCard]) {
      await expect(card.getByRole("button", { name: "Withdraw" })).toBeVisible();
      await expect(card.getByRole("button", { name: "Change lines" })).toBeVisible();
    }

    await pendingCard.getByRole("button", { name: "Withdraw" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Withdraw request" }).click();
    await expect(pendingCard).toHaveCount(0);
    await expect(approvedCard).toContainText("Projector");
    expect(
      (await prisma.equipmentRequest.findUniqueOrThrow({ where: { id: pending.id } })).status,
    ).toBe("CANCELLED");
    expect(
      (await prisma.equipmentRequest.findUniqueOrThrow({ where: { id: approved.id } })).status,
    ).toBe("APPROVED");
  });

  test("SCRUM-209 [AC1] TC-209-12: Reset on a venue search opened from the event still leads back to it", async ({
    browser,
  }) => {
    const { id } = await planningEvent("reset");
    const page = await signedIn(browser, "coordinator@test.local");
    await page.goto(`/venues/search?event=${id}&return=event&attendance=10`);

    await page.getByRole("link", { name: "Reset" }).click();
    await page.waitForURL(new RegExp(`/venues/search\\?event=${id}&return=event$`));
    await expect(page.getByRole("link", { name: "Back to the event" })).toHaveAttribute(
      "href",
      `/events/${id}?tab=arrangements`,
    );
  });
});
