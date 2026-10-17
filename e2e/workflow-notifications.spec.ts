import { test, expect } from "@playwright/test";

import { prisma } from "@/lib/db";
import { signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-45 — deciding a request in the app tells its Organiser. The notices
 * are read in SCRUM-48's notification list; this journey drives the decision
 * through the Coordinator's screen and checks the notice that was written.
 * Each test owns its request, made straight in the database, and removes it.
 * Test cases: docs/testing/SCRUM-45.md.
 */
const STAMP = Date.now();

async function underReview(label: string) {
  const name = `SCRUM-45 ${label} ${STAMP}`;
  const { id } = await prisma.event.create({
    data: {
      name,
      purpose: "Workflow notification journey",
      description: "Owned by the SCRUM-45 e2e spec.",
      status: "UNDER_REVIEW",
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      startAt: new Date("2031-08-01T02:00:00Z"),
      endAt: new Date("2031-08-01T10:00:00Z"),
      expectedAttendance: 60,
      venueRequirements: "Any hall",
      requiredFacilities: [],
      accessibilityNeeds: "None",
      preferredLayout: "Theatre",
      equipmentRequirements: "None",
      registrationNotes: "None",
      submittedAt: new Date(),
    },
    select: { id: true },
  });
  return { id, name };
}

const organiserNotices = (eventId: string) =>
  prisma.notification.findMany({
    where: { eventId, userId: "usr_organiser" },
    select: { type: true, title: true, message: true },
  });

test.describe("SCRUM-45 — Organiser and Coordinator workflow notifications", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  const eventIds: string[] = [];

  test.afterAll(async () => {
    await prisma.notification.deleteMany({
      where: { eventId: { in: eventIds } },
    });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
  });

  test("SCRUM-45 [AC2, AC12] TC-45-02: approving a request in the app tells its Organiser, naming the event", async ({
    browser,
  }) => {
    const request = await underReview("Approve");
    eventIds.push(request.id);

    const page = await signedIn(browser, "coordinator@test.local");
    await page
      .getByRole("row", { name: new RegExp(request.name) })
      .getByRole("button", { name: "Approve", exact: true })
      .click();
    await expect(
      page
        .getByRole("row", { name: new RegExp(request.name) })
        .getByTestId("status-badge"),
    ).toHaveAttribute("data-status", "PLANNING");

    expect(await organiserNotices(request.id)).toEqual([
      {
        type: "EVENT_STATUS_CHANGED",
        title: "Your request was approved",
        message: `"${request.name}" was approved and is now being planned.`,
      },
    ]);
  });

  test("SCRUM-45 [AC3] TC-45-03: rejecting a request in the app tells its Organiser the reason and what they can do next", async ({
    browser,
  }) => {
    const request = await underReview("Reject");
    eventIds.push(request.id);
    const reason = "The date clashes with exam week.";

    const page = await signedIn(browser, "coordinator@test.local");
    await page
      .getByRole("row", { name: new RegExp(request.name) })
      .getByRole("button", { name: "Reject", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: /Reject event request/i });
    await dialog.getByLabel("Rejection reason").fill(reason);
    await dialog.getByLabel("Amend and resubmit").check();
    await dialog.getByRole("button", { name: "Reject request" }).click();
    await expect(
      page
        .getByRole("row", { name: new RegExp(request.name) })
        .getByTestId("status-badge"),
    ).toHaveAttribute("data-status", "REJECTED");

    expect(await organiserNotices(request.id)).toEqual([
      {
        type: "EVENT_STATUS_CHANGED",
        title: "Your request was rejected",
        message: `"${request.name}" was rejected: ${reason} What you can do next: Amend and resubmit.`,
      },
    ]);
  });
});
