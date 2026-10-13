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
    await page
      .getByRole("dialog", { name: "Withdraw this venue request?" })
      .getByRole("button", { name: "Withdraw request" })
      .click();

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

  test("SCRUM-142 [AC10] TC-142-18: after only removing a line, the checklist waits for Technical Support's re-check before Confirm", async ({
    browser,
  }) => {
    const event = await planningEvent("Recheck");
    eventIds.push(event.id);
    const venue = await prisma.venue.create({
      data: {
        name: `SCRUM-142 recheck venue ${STAMP}`,
        location: "Test block",
        capacity: 100,
      },
      select: { id: true },
    });
    venueIds.push(venue.id);
    await prisma.booking.create({
      data: {
        eventId: event.id,
        venueId: venue.id,
        ...PERIOD,
        status: "APPROVED",
        requestedAttendance: 40,
        requestedById: "usr_coordinator",
      },
    });
    const { id: requestId } = await prisma.equipmentRequest.create({
      data: {
        eventId: event.id,
        requestedById: "usr_coordinator",
        status: "APPROVED",
        lines: {
          create: [
            { equipmentId: "eqp_projector", quantity: 2 },
            { equipmentId: "eqp_mic", quantity: 1 },
          ],
        },
      },
      select: { id: true },
    });
    for (const [equipmentId, quantity] of [
      ["eqp_projector", 2],
      ["eqp_mic", 1],
    ] as const) {
      await prisma.reservation.create({
        data: {
          eventId: event.id,
          equipmentId,
          requestId,
          quantity,
          ...PERIOD,
          reservedById: "usr_techsupport",
        },
      });
    }

    const page = await signedIn(browser, "coordinator@test.local");
    await page.goto("/equipment-requests");
    const card = page
      .getByTestId("equipment-request")
      .filter({ hasText: event.name });
    await card.getByRole("button", { name: "Change lines" }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: /^Remove Wireless Microphone/ })
      .click();
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(card.getByTestId("request-status")).toHaveAttribute(
      "data-status",
      "PENDING_REVIEW",
    );

    // The projectors are still reserved, but Confirm waits for the re-check.
    await page.goto("/events");
    await page
      .getByRole("row", { name: new RegExp(event.name) })
      .getByTestId("view-details-button")
      .click();
    const details = page.getByRole("dialog");
    await expect(details.getByTestId("readiness-item-equipment")).toContainText(
      "Awaiting Technical Support review",
    );
    await expect(
      details.getByRole("button", { name: "Confirm event" }),
    ).toBeDisabled();
  });

  /** An Approved request for Projector × 2, with the projectors reserved. */
  async function reservedRequest(label: string) {
    const event = await planningEvent(label);
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
    return { ...event, requestId };
  }

  test("SCRUM-142 [AC3] TC-142-05: the Coordinator withdraws a whole equipment request after confirming, and its reservation is released", async ({
    browser,
  }) => {
    const request = await reservedRequest("Withdraw");

    const page = await signedIn(browser, "coordinator@test.local");
    await page.goto("/equipment-requests");
    const card = page
      .getByTestId("equipment-request")
      .filter({ hasText: request.name });
    await card.getByRole("button", { name: "Withdraw request" }).click();
    const confirm = page.getByRole("dialog", {
      name: "Withdraw this equipment request?",
    });
    // Keeping it changes nothing.
    await confirm.getByRole("button", { name: "Keep it" }).click();
    await expect(confirm).toHaveCount(0);
    await card.getByRole("button", { name: "Withdraw request" }).click();
    await confirm.getByRole("button", { name: "Withdraw request" }).click();

    await expect(card.getByTestId("request-status")).toHaveAttribute(
      "data-status",
      "CANCELLED",
    );
    // A Cancelled request offers no more changes.
    await expect(
      card.getByRole("button", { name: "Withdraw request" }),
    ).toHaveCount(0);
    expect(
      await prisma.reservation.findMany({
        where: { eventId: request.id },
        select: { status: true },
      }),
    ).toEqual([{ status: "CANCELLED" }]);
  });

  test("SCRUM-142 [AC1] TC-142-15: a line with an invalid quantity is refused next to the field, and nothing is changed", async ({
    browser,
  }) => {
    const request = await reservedRequest("Invalid");

    const page = await signedIn(browser, "coordinator@test.local");
    await page.goto("/equipment-requests");
    await page
      .getByTestId("equipment-request")
      .filter({ hasText: request.name })
      .getByRole("button", { name: "Change lines" })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Equipment type").selectOption("eqp_mic");
    await dialog.getByLabel("Quantity").fill("0");
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(
      dialog.getByText("Quantity must be a positive whole number."),
    ).toBeVisible();
    await expect(dialog.getByLabel("Quantity")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(
      await prisma.equipmentRequest.findUniqueOrThrow({
        where: { id: request.requestId },
        select: { status: true },
      }),
    ).toEqual({ status: "APPROVED" });
    expect(
      await prisma.reservation.findMany({
        where: { eventId: request.id },
        select: { status: true },
      }),
    ).toEqual([{ status: "CONFIRMED" }]);
  });
});
