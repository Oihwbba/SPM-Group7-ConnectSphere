import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { usesLocalDatabase } from "./helpers";

/**
 * SCRUM-108 — the Organiser answers a clarification by changing only the
 * fields the Coordinator named, and amends a rejected request that goes back
 * to the same Coordinator. Each test creates its own event straight in the
 * database. Test cases: docs/testing/SCRUM-108.md.
 */

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/events");
}

const request = (name: string) => ({
  name,
  purpose: "SCRUM-108 journey",
  description: "Owned by the SCRUM-108 e2e spec.",
  organiserId: "usr_organiser",
  coordinatorId: "usr_coordinator",
  startAt: new Date("2031-08-01T02:00:00Z"),
  endAt: new Date("2031-08-01T10:00:00Z"),
  expectedAttendance: 400,
  venueRequirements: "Any hall",
  requiredFacilities: [],
  accessibilityNeeds: "None",
  preferredLayout: "Classroom",
  equipmentRequirements: "None",
  registrationNotes: "None",
  submittedAt: new Date(),
});

test.describe("SCRUM-108 — Answer a clarification, or amend and resubmit", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  let eventId: string;

  test.afterEach(async () => {
    await prisma.notification.deleteMany({ where: { eventId } });
    await prisma.auditLog.deleteMany({ where: { entityId: eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
  });

  test("SCRUM-108 [AC1, AC2, AC3, AC14] TC-108-10: the Coordinator lets the Organiser change the attendance, and the answer changes only that", async ({
    page,
  }) => {
    const name = `SCRUM-108 Clarify ${Date.now()}`;
    eventId = (
      await prisma.event.create({
        data: { ...request(name), status: "UNDER_REVIEW" },
        select: { id: true },
      })
    ).id;

    // --- Coordinator asks, ticking only Expected attendance (AC1) ---------
    await signIn(page, "coordinator@test.local");
    await page
      .getByRole("row", { name: new RegExp(name) })
      .getByRole("button", { name: /Ask/ })
      .click();
    const ask = page.getByRole("dialog", { name: /Request clarification/ });
    await ask
      .getByLabel("Clarification message")
      .fill("400 people in a classroom layout? Please confirm the numbers.");
    await ask.getByLabel("Expected attendance").check();
    await ask.getByRole("button", { name: "Send request" }).click();
    await expect(
      page.getByText("Clarification request sent to the organiser."),
    ).toBeVisible();

    // --- Organiser sees the question and only that field (AC2) -----------
    await signIn(page, "organiser@test.local");
    await page
      .getByRole("row", { name: new RegExp(name) })
      .getByTestId("view-details-button")
      .click();
    const details = page.getByRole("dialog");
    await expect(details.getByTestId("clarification-fields")).toHaveText(
      "The organiser may change: Expected attendance.",
    );
    await expect(details.getByLabel("Event name")).toHaveCount(0);

    // Failure path: an invalid value is refused, shown at its field, and
    // nothing changes; the clarification stays open.
    await details.getByLabel("Expected attendance").fill("0");
    await details
      .getByLabel("Response to clarification")
      .fill("Actually nobody is coming.");
    await details.getByRole("button", { name: "Send response" }).click();
    await expect(
      details.getByText("Attendance must be a positive whole number."),
    ).toBeVisible();
    await expect(details.getByLabel("Expected attendance")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(
      await prisma.clarificationRequest.findFirstOrThrow({
        where: { eventId },
        select: { status: true },
      }),
    ).toEqual({ status: "OPEN" });

    await details.getByLabel("Expected attendance").fill("300");
    await details
      .getByLabel("Response to clarification")
      .fill("We expect 300, classroom is right.");
    await details.getByRole("button", { name: "Send response" }).click();
    await expect(
      page.getByText("Response sent to the coordinator."),
    ).toBeVisible();

    // Only the named field changed, the event stays Under Review (AC3), and
    // the answer and the change are recorded with who (AC14).
    expect(
      await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: {
          expectedAttendance: true,
          preferredLayout: true,
          status: true,
        },
      }),
    ).toEqual({
      expectedAttendance: 300,
      preferredLayout: "Classroom",
      status: "UNDER_REVIEW",
    });
    expect(
      await prisma.auditLog.findMany({
        where: {
          entityId: eventId,
          action: { in: ["CLARIFICATION_ANSWERED", "UPDATED"] },
        },
        select: { action: true, actorId: true, fieldName: true },
        orderBy: { action: "asc" },
      }),
    ).toEqual([
      {
        action: "CLARIFICATION_ANSWERED",
        actorId: "usr_organiser",
        fieldName: null,
      },
      {
        action: "UPDATED",
        actorId: "usr_organiser",
        fieldName: "expectedAttendance",
      },
    ]);
  });

  test("SCRUM-108 [AC7, AC9, AC10, AC11, AC14] TC-108-11: an amended request shows its rejection reason while editing and goes back to the same Coordinator", async ({
    page,
  }) => {
    const name = `SCRUM-108 Amend ${Date.now()}`;
    const reason =
      "Venue is unavailable on that date — please propose another.";
    eventId = (
      await prisma.event.create({
        data: {
          ...request(name),
          status: "REJECTED",
          decidedAt: new Date(),
          decidedById: "usr_coordinator",
          decisionReason: reason,
          rejectionOutcome: "AMEND_AND_RESUBMIT",
        },
        select: { id: true },
      })
    ).id;
    // The history row the Coordinator's rejection writes.
    await prisma.auditLog.create({
      data: {
        entityType: "Event",
        entityId: eventId,
        action: "STATUS_CHANGED",
        actorId: "usr_coordinator",
        fieldName: "status",
        oldValue: "UNDER_REVIEW",
        newValue: "REJECTED",
        summary: reason,
      },
    });

    await signIn(page, "organiser@test.local");
    await page
      .getByRole("row", { name: new RegExp(name) })
      .getByTestId("amend-rejected-button")
      .click();
    // AC7: the reason stays in view while amending.
    await expect(page.getByTestId("amend-rejection-reason")).toContainText(
      reason,
    );

    const next = page.getByRole("button", { name: "Next", exact: true });
    await next.click();
    // Failure path: the amendment is checked like a first submission (AC10),
    // so a start date in the past stops it at this step.
    const start = page.getByLabel("Proposed Start Date & Time *");
    const end = page.getByLabel("Proposed End Date & Time *");
    await start.fill("2020-01-01T10:00");
    await end.fill("2020-01-01T12:00");
    await next.click();
    await expect(
      page.getByText("Proposed date cannot be in the past."),
    ).toBeVisible();
    // Back to the request's own dates (10:00–18:00 SGT on 1 Aug 2031).
    await start.fill("2031-08-01T10:00");
    await end.fill("2031-08-01T18:00");
    await next.click();
    await page
      .getByLabel("Venue Requirements *")
      .fill("Any hall — a different date is fine.");
    await expect(page.getByTestId("amend-rejection-reason")).toContainText(
      reason,
    );
    for (let i = 0; i < 3; i++) await next.click();
    await page
      .getByRole("button", { name: /Submit Request for Review/i })
      .click();
    await expect(
      page.getByText("Event request submitted for review successfully!"),
    ).toBeVisible();

    // AC9, AC11: the same event, back Under Review with the same Coordinator,
    // and the resubmission recorded with who (AC14).
    expect(
      await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { status: true, coordinatorId: true, venueRequirements: true },
      }),
    ).toEqual({
      status: "UNDER_REVIEW",
      coordinatorId: "usr_coordinator",
      venueRequirements: "Any hall — a different date is fine.",
    });
    expect(
      await prisma.auditLog.findFirst({
        where: {
          entityId: eventId,
          summary: "Amended and resubmitted (SCRUM-108)",
        },
        select: { actorId: true, oldValue: true, newValue: true },
      }),
    ).toEqual({
      actorId: "usr_organiser",
      oldValue: "REJECTED",
      newValue: "SUBMITTED",
    });
    expect(
      await prisma.auditLog.count({
        where: { entityId: eventId, action: "ASSIGNED" },
      }),
    ).toBe(0);
    // AC9, AC14: the value the amendment replaced is kept, with who and when,
    // and the rejection and its reason are still in the history.
    const history = await prisma.auditLog.findMany({
      where: { entityId: eventId },
      select: {
        action: true,
        actorId: true,
        fieldName: true,
        oldValue: true,
        newValue: true,
        summary: true,
        createdAt: true,
      },
    });
    expect(history).toContainEqual({
      action: "UPDATED",
      actorId: "usr_organiser",
      fieldName: "venueRequirements",
      oldValue: "Any hall",
      newValue: "Any hall — a different date is fine.",
      summary: "Amended before resubmitting (SCRUM-108)",
      createdAt: expect.any(Date),
    });
    expect(history).toContainEqual({
      action: "STATUS_CHANGED",
      actorId: "usr_coordinator",
      fieldName: "status",
      oldValue: "UNDER_REVIEW",
      newValue: "REJECTED",
      summary: reason,
      createdAt: expect.any(Date),
    });
    expect(history.every((row) => row.createdAt instanceof Date)).toBe(true);
  });
});
