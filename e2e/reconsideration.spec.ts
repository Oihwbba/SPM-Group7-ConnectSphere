import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { usesLocalDatabase } from "./helpers";

/**
 * SCRUM-26 — the assigned Coordinator resolves arrangements flagged Needs
 * Reconsideration from the event's details. Each test creates its own event
 * and flagged booking straight in the database, since the stories that raise
 * flags (SCRUM-25, SCRUM-128, SCRUM-160, SCRUM-161, SCRUM-32, SCRUM-166) call
 * the same helper. Test cases: docs/testing/SCRUM-26.md.
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
      needsReconsideration: true,
      reconsiderationFlaggedAt: new Date(),
      reconsiderationReason: REASON,
    },
    select: { id: true },
  });
  return { eventId: event.id, bookingId: booking.id };
}

test.describe("SCRUM-26 — Flag and resolve arrangements affected by a change", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  let eventId: string;

  test.afterEach(async () => {
    const bookings = await prisma.booking.findMany({
      where: { eventId },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [eventId, ...bookings.map((b) => b.id)] } },
    });
    await prisma.booking.deleteMany({ where: { eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
  });

  test("SCRUM-26 [AC7, AC8, AC12] TC-26-14: the Coordinator sees the flag holding back confirmation, and keeps the booking with Still stands", async ({
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
    await expect(details.getByTestId("readiness-item-venue")).toContainText(
      "Needs reconsideration",
    );
    await expect(details.getByRole("button", { name: "Confirm event" })).toBeDisabled();

    await panel.getByRole("button", { name: "Still stands" }).click();
    await expect(page.getByText("Exhibition Hall (Approved) still stands.")).toBeVisible();

    // The panel empties and the checklist reads the booking as Approved again.
    await expect(details.getByTestId("reconsideration-panel")).toHaveCount(0);
    await expect(details.getByTestId("readiness-item-venue")).toHaveAttribute(
      "data-complete",
      "true",
    );
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
      page.getByText("Exhibition Hall (Approved) was cancelled. The event is back in Planning."),
    ).toBeVisible();

    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status,
    ).toBe("CANCELLED");
    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).status,
    ).toBe("PLANNING");
  });

  test("SCRUM-26 [AC7, AC12] TC-26-14: the Organiser sees the venue needs reconsideration, but no reason and no way to resolve it", async ({
    page,
  }) => {
    const name = `SCRUM-26 Organiser ${Date.now()}`;
    ({ eventId } = await eventWithFlaggedBooking(name, "PLANNING"));

    await signIn(page, "organiser@test.local");
    const details = await openDetails(page, name);

    await expect(details.getByTestId("readiness-item-venue")).toContainText(
      "Needs reconsideration",
    );
    await expect(details.getByTestId("readiness-item-venue")).not.toContainText(REASON);
    await expect(details.getByTestId("reconsideration-panel")).toHaveCount(0);
  });
});
