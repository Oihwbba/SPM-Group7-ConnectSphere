import { test, expect } from "@playwright/test";

import { prisma } from "@/lib/db";
import { signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-142 — while an event is being planned, its Coordinator changes an
 * equipment request's lines and withdraws a pending venue request. Each test
 * owns its event, venue, requests and reservations (written straight to the
 * database) and removes them. Test cases: docs/testing/SCRUM-142.md.
 */
const STAMP = Date.now();
const PERIOD = {
  startAt: new Date("2031-09-01T01:00:00Z"),
  endAt: new Date("2031-09-01T09:00:00Z"),
};

async function planningEvent(label: string) {
  const name = `SCRUM-142 ${label} ${STAMP}`;
  const { id } = await prisma.event.create({
    data: {
      name,
      purpose: "Change or withdraw journey",
      description: "Owned by the SCRUM-142 e2e spec.",
      status: "PLANNING",
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      ...PERIOD,
      expectedAttendance: 40,
      submittedAt: new Date(),
    },
    select: { id: true },
  });
  return { id, name };
}

test.describe("SCRUM-142 — Change equipment lines or withdraw a venue request", () => {
  test.skip(!usesLocalDatabase, "writes its own requests; local database only");

  const eventIds: string[] = [];
  const venueIds: string[] = [];

  test.afterAll(async () => {
    const requestIds = (
      await prisma.equipmentRequest.findMany({
        where: { eventId: { in: eventIds } },
        select: { id: true },
      })
    ).map((r) => r.id);
    const bookingIds = (
      await prisma.booking.findMany({
        where: { eventId: { in: eventIds } },
        select: { id: true },
      })
    ).map((b) => b.id);
    await prisma.notification.deleteMany({
      where: { eventId: { in: eventIds } },
    });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...eventIds, ...bookingIds] } },
    });
    await prisma.reservation.deleteMany({
      where: { eventId: { in: eventIds } },
    });
    await prisma.equipmentRequestUpdate.deleteMany({
      where: { requestId: { in: requestIds } },
    });
    await prisma.equipmentRequest.deleteMany({
      where: { id: { in: requestIds } },
    });
    await prisma.booking.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.venue.deleteMany({ where: { id: { in: venueIds } } });
  });

  test("SCRUM-142 [AC1, AC2] TC-142-01, TC-142-02: the Coordinator swaps a reserved line; the request goes back to Pending Review and the reservation is released", async ({
    browser,
  }) => {
    const event = await planningEvent("Lines");
    eventIds.push(event.id);
    const { id: requestId } = await prisma.equipmentRequest.create({
      data: {
        eventId: event.id,
        requestedById: "usr_coordinator",
        status: "APPROVED",
        lines: { create: [{ equipmentId: "eqp_projector", quantity: 2 }] },
      },
      select: { id: true },
    });
    await prisma.reservation.create({
      data: {
        eventId: event.id,
        equipmentId: "eqp_projector",
        requestId,
        quantity: 2,
        ...PERIOD,
        reservedById: "usr_techsupport",
      },
    });

    const page = await signedIn(browser, "coordinator@test.local");
    await page.goto("/equipment-requests");
    const card = page
      .getByTestId("equipment-request")
      .filter({ hasText: event.name });
    await card.getByRole("button", { name: "Change lines" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /^Remove Projector/ }).click();
    await dialog.getByLabel("Equipment type").selectOption("eqp_mic");
    await dialog.getByLabel("Quantity").fill("3");
    await dialog.getByRole("button", { name: "Add equipment" }).click();
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(card.getByTestId("request-status")).toHaveAttribute(
      "data-status",
      "PENDING_REVIEW",
    );
    // The history says what changed; the removed line is kept but not live.
    await expect(card).toContainText(
      "added Wireless Microphone × 3; removed Projector. 1 reservation(s) cancelled.",
    );
    expect(
      await prisma.equipmentRequestLine.findMany({
        where: { requestId, removedAt: null },
        select: { equipmentId: true, quantity: true },
      }),
    ).toEqual([{ equipmentId: "eqp_mic", quantity: 3 }]);
    expect(
      await prisma.reservation.findMany({
        where: { eventId: event.id },
        select: { status: true },
      }),
    ).toEqual([{ status: "CANCELLED" }]);
  });

  test("SCRUM-142 [AC4] TC-142-07: the Coordinator withdraws a pending venue request from the readiness checklist", async ({
    browser,
  }) => {
    const event = await planningEvent("Venue");
    eventIds.push(event.id);
    const venue = await prisma.venue.create({
      data: {
        name: `SCRUM-142 venue ${STAMP}`,
        location: "Test block",
        capacity: 100,
      },
      select: { id: true },
    });
    venueIds.push(venue.id);
    const { id: bookingId } = await prisma.booking.create({
      data: {
        eventId: event.id,
        venueId: venue.id,
        ...PERIOD,
        status: "PENDING",
        requestedAttendance: 40,
        requestedById: "usr_coordinator",
      },
      select: { id: true },
    });

    const page = await signedIn(browser, "coordinator@test.local");
    await page
      .getByRole("row", { name: new RegExp(event.name) })
      .getByTestId("view-details-button")
      .click();
    const venueItem = page
      .getByRole("dialog")
      .getByTestId("readiness-item-venue");
    await expect(venueItem).toContainText("Pending");

    await venueItem.getByRole("button", { name: "Withdraw request" }).click();

    await expect(venueItem).toContainText("Not requested");
    expect(
      (
        await prisma.booking.findUniqueOrThrow({
          where: { id: bookingId },
          select: { status: true },
        })
      ).status,
    ).toBe("CANCELLED");
  });
});
