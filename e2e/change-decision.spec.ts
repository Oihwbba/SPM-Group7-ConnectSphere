import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { usesLocalDatabase } from "./helpers";

/**
 * SCRUM-128 — the assigned Coordinator decides an Organiser's change request
 * from the event's details. Each test creates its own event and Submitted
 * change request straight in the database, as SCRUM-41 records them. Test
 * cases: docs/testing/SCRUM-128.md.
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

const PERIOD = {
  startAt: new Date("2033-02-01T02:00:00Z"),
  endAt: new Date("2033-02-01T06:00:00Z"),
};

let eventId: string;

async function eventWithRequest(name: string) {
  const event = await prisma.event.create({
    data: {
      name,
      purpose: "SCRUM-128 journey",
      description: "Owned by the SCRUM-128 e2e spec.",
      status: "CONFIRMED",
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      ...PERIOD,
      expectedAttendance: 40,
      submittedAt: new Date(),
    },
    select: { id: true },
  });
  eventId = event.id;
  await prisma.booking.create({
    data: {
      eventId,
      venueId: "ven_hall",
      ...PERIOD,
      status: "APPROVED",
      requestedById: "usr_coordinator",
      decidedById: "usr_venuestaff",
      decidedAt: new Date(),
    },
  });
  await prisma.eventChangeRequest.create({
    data: {
      eventId,
      requestedById: "usr_organiser",
      reason: "More people signed up.",
      fields: {
        create: [{ fieldName: "expectedAttendance", oldValue: "40", newValue: "60", isMajor: true }],
      },
    },
  });
}

test.describe("SCRUM-128 — Decide a change request and apply it in one step", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  test.afterEach(async () => {
    const bookings = await prisma.booking.findMany({ where: { eventId }, select: { id: true } });
    const requests = await prisma.eventChangeRequest.findMany({ where: { eventId }, select: { id: true } });
    await prisma.auditLog.deleteMany({
      where: {
        entityId: { in: [eventId, ...bookings.map((b) => b.id), ...requests.map((r) => r.id)] },
      },
    });
    await prisma.notification.deleteMany({ where: { eventId } });
    await prisma.booking.deleteMany({ where: { eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
  });

  test("SCRUM-128 [AC1, AC2, AC4, AC5] TC-128-13: the Coordinator sees the current and requested values and what's affected, approves, and the Confirmed event returns to Planning with its booking flagged", async ({
    page,
  }) => {
    const name = `SCRUM-128 Approve ${Date.now()}`;
    await eventWithRequest(name);

    await signIn(page, "coordinator@test.local");
    const dialog = await openDetails(page, name);
    const decision = dialog.getByTestId("change-request-decision");
    await expect(decision.getByRole("row", { name: /Expected attendance/ })).toContainText("40");
    await expect(decision.getByRole("row", { name: /Expected attendance/ })).toContainText("60");
    await expect(decision.getByTestId("potentially-affected")).toContainText(
      "Exhibition Hall (Approved)",
    );

    await decision.getByRole("button", { name: "Approve" }).click();
    await expect(
      page.getByText(
        "Change request approved. The event is back in Planning and its arrangements are flagged.",
      ),
    ).toBeVisible();

    expect(await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({
      expectedAttendance: 60,
      status: "PLANNING",
    });
    expect(
      (await prisma.booking.findFirstOrThrow({ where: { eventId } })).needsReconsideration,
    ).toBe(true);
  });

  test("SCRUM-128 [AC3, AC9, AC10] TC-128-14: rejecting needs a reason, which the Organiser then sees; the Organiser can't decide", async ({
    page,
  }) => {
    const name = `SCRUM-128 Reject ${Date.now()}`;
    const REASON = "No larger room is free that day.";
    await eventWithRequest(name);

    // AC9: the Organiser sees their request but no way to decide it.
    await signIn(page, "organiser@test.local");
    let dialog = await openDetails(page, name);
    await expect(dialog.getByTestId("change-request")).toBeVisible();
    await expect(dialog.getByTestId("change-request-decision")).toHaveCount(0);

    await signIn(page, "coordinator@test.local");
    dialog = await openDetails(page, name);
    const decision = dialog.getByTestId("change-request-decision");
    await decision.getByRole("button", { name: "Reject" }).click();
    const confirmReject = decision.getByRole("button", { name: "Reject change request" });
    // Failure path (AC3): no reason, no rejection.
    await expect(confirmReject).toBeDisabled();
    await decision.getByLabel("Reason for rejecting the change request").fill(REASON);
    await confirmReject.click();
    await expect(
      page.getByText("Change request rejected. The organiser has been told why."),
    ).toBeVisible();
    expect((await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).expectedAttendance).toBe(40);

    // AC10: the Organiser sees it was rejected and why.
    await signIn(page, "organiser@test.local");
    dialog = await openDetails(page, name);
    await expect(dialog.getByTestId("change-request")).toHaveAttribute("data-status", "REJECTED");
    await expect(dialog.getByTestId("change-request")).toContainText(REASON);
  });
});
