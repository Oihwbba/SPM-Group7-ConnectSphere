import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { usesLocalDatabase } from "./helpers";

/**
 * SCRUM-26 — the assigned Coordinator resolves arrangements flagged Needs
 * Reconsideration from the event's details. Each test creates its own event
 * and flagged booking or reservation straight in the database, since the
 * stories that raise flags (SCRUM-25, SCRUM-128, SCRUM-160, SCRUM-161,
 * SCRUM-32, SCRUM-166) call the same helper. Test cases:
 * docs/testing/SCRUM-26.md, and SCRUM-131.md for the badge (TC-131-04, 05).
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

const START = new Date("2032-09-01T01:00:00Z");
const END = new Date("2032-09-01T09:00:00Z");
const REASON = "The event's expected attendance changed.";

async function eventWithFlaggedBooking(
  name: string,
  status: "PLANNING" | "CONFIRMED",
  flagged = true,
) {
  const event = await prisma.event.create({
    data: {
      name,
      purpose: "SCRUM-26 journey",
      description: "Owned by the SCRUM-26 e2e spec.",
      status,
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      startAt: START,
      endAt: END,
      expectedAttendance: 60,
      submittedAt: new Date(),
    },
    select: { id: true },
  });
  const booking = await prisma.booking.create({
    data: {
      eventId: event.id,
      venueId: "ven_hall",
      startAt: START,
      endAt: END,
      status: "APPROVED",
      requestedAttendance: 60,
      requestedById: "usr_coordinator",
      decidedById: "usr_venuestaff",
      decidedAt: new Date(),
      ...(flagged && {
        needsReconsideration: true,
        reconsiderationFlaggedAt: new Date(),
        reconsiderationReason: REASON,
      }),
    },
    select: { id: true },
  });
  return { eventId: event.id, bookingId: booking.id };
}

const EQUIPMENT_REASON = "Technical Support can no longer provide it: one projector is damaged.";

/**
 * SCRUM-131 TC-131-05: a Planning event with an Approved booking and an
 * approved equipment request reserved in full (two Projectors and a Wireless
 * Microphone), so the Equipment item reads Reserved until a flag is raised.
 */
async function eventWithReservedEquipment(name: string) {
  const { eventId } = await eventWithFlaggedBooking(name, "PLANNING", false);
  const request = await prisma.equipmentRequest.create({
    data: {
      eventId,
      requestedById: "usr_coordinator",
      status: "APPROVED",
      decidedAt: new Date(),
      lines: {
        create: [
          { equipmentId: "eqp_projector", quantity: 2 },
          { equipmentId: "eqp_mic", quantity: 1 },
        ],
      },
    },
    select: { id: true },
  });
  await prisma.reservation.createMany({
    data: [
      { equipmentId: "eqp_projector", quantity: 2 },
      { equipmentId: "eqp_mic", quantity: 1 },
    ].map((line) => ({
      ...line,
      eventId,
      requestId: request.id,
      startAt: START,
      endAt: END,
      status: "CONFIRMED" as const,
      reservedById: "usr_techsupport",
    })),
  });
  return { eventId };
}

test.describe("SCRUM-26 — Flag and resolve arrangements affected by a change", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  let eventId: string | undefined;

  test.afterEach(async () => {
    // A test that failed before creating its event has nothing to remove. An
    // undefined id would empty the filters below and delete every booking.
    if (!eventId) return;
    const bookings = await prisma.booking.findMany({
      where: { eventId },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [eventId, ...bookings.map((b) => b.id)] } },
    });
    // TC-131-05's reservations go first: they reference its equipment request.
    await prisma.reservation.deleteMany({ where: { eventId } });
    await prisma.equipmentRequest.deleteMany({ where: { eventId } });
    await prisma.booking.deleteMany({ where: { eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
    eventId = undefined;
  });

  test("SCRUM-26 [AC7, AC8, AC12] TC-26-14, SCRUM-131 [AC3] TC-131-04: the Coordinator sees the flag beside the booking's Approved status holding back confirmation, and keeps the booking with Still stands", async ({
    page,
  }) => {
    const name = `SCRUM-26 Still stands ${Date.now()}`;
    let bookingId: string;
    ({ eventId, bookingId } = await eventWithFlaggedBooking(name, "PLANNING"));

    await signIn(page, "coordinator@test.local");
    const details = await openDetails(page, name);

    // AC12: flagged, so the checklist isn't complete and Confirm is off.
    const panel = details.getByTestId("reconsideration-panel");
    await expect(panel).toContainText("Exhibition Hall (Approved)");
    await expect(panel).toContainText(REASON);
    // SCRUM-131 AC3: the flag is a badge beside the status, not in its place.
    const venueItem = details.getByTestId("readiness-item-venue");
    await expect(venueItem.getByTestId("venue-booking")).toContainText(
      `Approved Needs Reconsideration – ${REASON}`,
    );
    await expect(venueItem.getByTestId("needs-reconsideration").first()).toHaveText(
      "Needs Reconsideration",
    );
    await expect(details.getByRole("button", { name: "Confirm event" })).toBeDisabled();

    await panel.getByRole("button", { name: "Still stands" }).click();
    await expect(page.getByText("Exhibition Hall (Approved) still stands.")).toBeVisible();

    // The panel empties and the checklist reads the booking as Approved again.
    await expect(details.getByTestId("reconsideration-panel")).toHaveCount(0);
    await expect(venueItem).toHaveAttribute("data-complete", "true");
    await expect(venueItem.getByTestId("needs-reconsideration")).toHaveCount(0);
    expect(
      await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } }),
    ).toMatchObject({
      status: "APPROVED",
      needsReconsideration: false,
      reconsiderationResolvedById: "usr_coordinator",
    });
  });

  test("SCRUM-26 [AC7, AC9, AC10] TC-26-14: cancelling a flagged booking of a Confirmed event releases it and returns the event to Planning", async ({
    page,
  }) => {
    const name = `SCRUM-26 Cancel ${Date.now()}`;
    let bookingId: string;
    ({ eventId, bookingId } = await eventWithFlaggedBooking(name, "CONFIRMED"));

    await signIn(page, "coordinator@test.local");
    const details = await openDetails(page, name);
    await details
      .getByTestId("reconsideration-panel")
      .getByRole("button", { name: "Cancel arrangement" })
      .click();

    const confirm = page.getByRole("dialog", { name: /Cancel Exhibition Hall/ });
    // Failure path: keeping it for now writes nothing.
    await confirm.getByRole("button", { name: "Keep it for now" }).click();
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status,
    ).toBe("APPROVED");

    await details
      .getByTestId("reconsideration-panel")
      .getByRole("button", { name: "Cancel arrangement" })
      .click();
    await page
      .getByRole("dialog", { name: /Cancel Exhibition Hall/ })
      .getByRole("button", { name: "Cancel arrangement" })
      .click();
    await expect(
      page.getByText(
        "Exhibition Hall (Approved) was cancelled. Request a venue again when you're ready. The event is back in Planning.",
      ),
    ).toBeVisible();

    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status,
    ).toBe("CANCELLED");
    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).status,
    ).toBe("PLANNING");
  });

  test("SCRUM-26 [AC7, AC12] TC-26-14, SCRUM-131 [AC3] TC-131-04: the Organiser sees the venue needs reconsideration beside its status, but no reason and no way to resolve it", async ({
    page,
  }) => {
    const name = `SCRUM-26 Organiser ${Date.now()}`;
    ({ eventId } = await eventWithFlaggedBooking(name, "PLANNING"));

    await signIn(page, "organiser@test.local");
    const details = await openDetails(page, name);

    await expect(details.getByTestId("readiness-item-venue")).toContainText(
      "Approved Needs Reconsideration",
    );
    await expect(details.getByTestId("readiness-item-venue")).not.toContainText(REASON);
    await expect(details.getByTestId("reconsideration-panel")).toHaveCount(0);
  });

  test("SCRUM-26 [AC12] TC-26-13, SCRUM-131 [AC2, AC3] TC-131-05: a confirmed reservation reads Reserved, never Confirmed, and once flagged reads Reserved with the equipment named and the Needs Reconsideration badge beside it", async ({
    page,
  }) => {
    const name = `SCRUM-131 Reserved ${Date.now()}`;
    ({ eventId } = await eventWithReservedEquipment(name));

    await signIn(page, "coordinator@test.local");
    let details = await openDetails(page, name);

    // AC2: reserved in full, so the item is complete and reads Reserved.
    let equipment = details.getByTestId("readiness-item-equipment");
    await expect(equipment).toHaveAttribute("data-complete", "true");
    await expect(equipment).toContainText("Equipment, complete — Reserved");
    await expect(equipment).not.toContainText("Confirmed");
    await expect(equipment.getByTestId("needs-reconsideration")).toHaveCount(0);

    // Both reservations flagged with one reason, as SCRUM-32's report does.
    await prisma.reservation.updateMany({
      where: { eventId },
      data: {
        needsReconsideration: true,
        reconsiderationFlaggedAt: new Date(),
        reconsiderationReason: EQUIPMENT_REASON,
      },
    });
    await page.reload();
    details = await openDetails(page, name);

    // AC3: still Reserved, naming what is flagged, with the badge beside it
    // and then the reason; SCRUM-26 AC12: the item is now incomplete. The
    // flagged types may be listed in either order.
    equipment = details.getByTestId("readiness-item-equipment");
    await expect(equipment).toHaveAttribute("data-complete", "false");
    await expect(equipment).toContainText(
      new RegExp(
        `Reserved: (Projector, Wireless Microphone|Wireless Microphone, Projector) Needs Reconsideration – ${EQUIPMENT_REASON.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      ),
    );
    await expect(equipment.getByTestId("needs-reconsideration")).toHaveText(
      "Needs Reconsideration",
    );
    await expect(equipment).not.toContainText("Confirmed");
  });
});
