import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { usesLocalDatabase } from "./helpers";

/**
 * SCRUM-166 — the operational safety check, end to end: the Coordinator
 * requests it, a Safety Officer reviews the arrangements and records the
 * outcome, and Confirm waits for Approved. Each test creates its own event
 * straight in the database. Test cases: docs/testing/SCRUM-166.md.
 */

async function signIn(page: Page, email: string, landing: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`**${landing}`);
}

async function openChecklist(page: Page, name: string) {
  await page
    .getByRole("row", { name: new RegExp(name) })
    .getByTestId("view-details-button")
    .click();
  const checklist = page.getByRole("dialog").getByTestId("readiness-checklist");
  await expect(checklist).toBeVisible();
  return checklist;
}

const PERIOD = {
  startAt: new Date("2032-11-02T02:00:00Z"),
  endAt: new Date("2032-11-02T06:00:00Z"),
};

async function arrangedEvent(name: string) {
  const event = await prisma.event.create({
    data: {
      name,
      purpose: "SCRUM-166 journey",
      description: "Owned by the SCRUM-166 e2e spec.",
      status: "PLANNING",
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      ...PERIOD,
      expectedAttendance: 150,
      accessibilityNeeds: "Two wheelchair users",
      preferredLayout: "Theatre",
      submittedAt: new Date(),
      // SCRUM-170 AC4: Equipment is always on the checklist; this event needs none.
      noEquipmentNeededAt: new Date(),
      noEquipmentNeededById: "usr_coordinator",
    },
    select: { id: true },
  });
  await prisma.booking.create({
    data: {
      eventId: event.id,
      venueId: "ven_hall",
      ...PERIOD,
      status: "APPROVED",
      requestedAttendance: 150,
      requestedLayout: "theatre",
      requestedById: "usr_coordinator",
      decidedById: "usr_venuestaff",
      decidedAt: new Date(),
    },
  });
  return event.id;
}

test.describe("SCRUM-166 — Operational safety check", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  let eventId: string;

  test.afterEach(async () => {
    const bookings = await prisma.booking.findMany({ where: { eventId }, select: { id: true } });
    const checks = await prisma.safetyCheck.findMany({ where: { eventId }, select: { id: true } });
    await prisma.auditLog.deleteMany({
      where: {
        entityId: { in: [eventId, ...bookings.map((b) => b.id), ...checks.map((c) => c.id)] },
      },
    });
    await prisma.notification.deleteMany({ where: { eventId } });
    await prisma.safetyCheck.deleteMany({ where: { eventId } });
    await prisma.booking.deleteMany({ where: { eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
  });

  test("SCRUM-166 [AC1, AC2, AC3, AC9, AC14] TC-166-15: the Coordinator requests a check, the Safety Officer reviews and approves it, and only then can the Coordinator confirm", async ({
    page,
  }) => {
    const name = `SCRUM-166 Approve ${Date.now()}`;
    eventId = await arrangedEvent(name);

    // AC9: venue arranged, but no check yet, so Confirm is off.
    await signIn(page, "coordinator@test.local", "/events");
    let checklist = await openChecklist(page, name);
    await expect(checklist.getByTestId("readiness-item-safety")).toContainText("Not requested");
    await expect(checklist.getByRole("button", { name: "Confirm event" })).toBeDisabled();
    await checklist.getByRole("button", { name: "Request safety check" }).click();
    await expect(
      page.getByText("Safety check requested. The Safety Officers have been notified."),
    ).toBeVisible();
    await expect(checklist.getByTestId("readiness-item-safety")).toContainText("Awaiting review");
    await expect(checklist.getByRole("button", { name: "Request safety check" })).toHaveCount(0);

    // AC1, AC2: the officer finds it in the queue and reviews the venue.
    await signIn(page, "safety@test.local", "/safety-checks");
    await page.getByRole("link", { name: new RegExp(name) }).click();
    const venue = page.getByTestId("safety-check-venue");
    await expect(venue).toContainText("Exhibition Hall");
    await expect(venue).toContainText("200");
    await expect(venue).toContainText("theatre");
    await expect(page.getByText("Two wheelchair users")).toBeVisible();

    // AC3: Approve needs no note.
    await page.getByLabel(/^Approve/).check();
    await page.getByRole("button", { name: "Record outcome" }).click();
    await expect(page.getByTestId("safety-check-status")).toContainText("Approved");

    // AC14: approval didn't confirm it; the Coordinator does.
    await signIn(page, "coordinator@test.local", "/events");
    checklist = await openChecklist(page, name);
    await expect(checklist.getByTestId("readiness-item-safety")).toContainText("Approved");
    await checklist.getByRole("button", { name: "Confirm event" }).click();
    await expect(page.getByText("Event confirmed.")).toBeVisible();
  });

  test("SCRUM-166 [AC3, AC4, AC10] TC-166-16: changes need a note and a picked arrangement; the picked booking is flagged and the Organiser sees the state without the note", async ({
    page,
  }) => {
    const name = `SCRUM-166 Changes ${Date.now()}`;
    const NOTE = "Keep the east fire exit clear of seating.";
    eventId = await arrangedEvent(name);
    await prisma.safetyCheck.create({ data: { eventId, requestedById: "usr_coordinator" } });

    await signIn(page, "safety@test.local", "/safety-checks");
    await page.getByRole("link", { name: new RegExp(name) }).click();
    await page.getByLabel(/^Request changes/).check();
    const record = page.getByRole("button", { name: "Record outcome" });

    // Failure path (AC3): no note and no pick, so it can't be recorded.
    await expect(record).toBeDisabled();
    await page.getByLabel(/^Note/).fill(NOTE);
    await expect(record).toBeDisabled();
    await page.getByRole("checkbox", { name: "Exhibition Hall" }).check();
    await record.click();
    await expect(page.getByTestId("safety-check-status")).toContainText("Changes requested");

    // AC10: the booking is flagged with the note; the Coordinator sees why.
    await signIn(page, "coordinator@test.local", "/events");
    const checklist = await openChecklist(page, name);
    await expect(checklist.getByTestId("readiness-item-safety")).toContainText(
      `Changes requested – ${NOTE}`,
    );
    await expect(
      checklist.getByTestId("readiness-item-venue").getByTestId("needs-reconsideration").first(),
    ).toHaveText("Needs Reconsideration");

    // AC4: the Organiser sees the state, not the note.
    await signIn(page, "organiser@test.local", "/events");
    const organiserView = await openChecklist(page, name);
    await expect(organiserView.getByTestId("readiness-item-safety")).toContainText(
      "Changes requested",
    );
    await expect(organiserView).not.toContainText(NOTE);
  });
});
