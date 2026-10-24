import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { usesLocalDatabase } from "./helpers";

/**
 * SCRUM-126 — the Coordinator rejects a request as needing a new submission,
 * and the Organiser starts a new Draft from it instead of amending it. The
 * event is created straight in the database so the journey owns its data.
 * Test cases: docs/testing/SCRUM-126.md.
 */

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/events");
}

test.describe("SCRUM-126 — Rejected as needing a new request", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  let eventName: string;

  test.beforeEach(async () => {
    eventName = `SCRUM-126 New Request ${Date.now()}`;
    await prisma.event.create({
      data: {
        name: eventName,
        purpose: "Rejection outcome journey",
        description: "Owned by the SCRUM-126 e2e spec.",
        status: "UNDER_REVIEW",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        startAt: new Date("2031-07-01T02:00:00Z"),
        endAt: new Date("2031-07-01T10:00:00Z"),
        expectedAttendance: 80,
        venueRequirements: "Any hall",
        requiredFacilities: [],
        accessibilityNeeds: "None",
        preferredLayout: "Theatre",
        equipmentRequirements: "None",
        registrationNotes: "None",
        submittedAt: new Date(),
      },
    });
  });

  test.afterEach(async () => {
    // The rejected event and the Draft started from it share the name.
    const ids = (
      await prisma.event.findMany({
        where: { name: eventName },
        select: { id: true },
      })
    ).map((e) => e.id);
    await prisma.notification.deleteMany({ where: { eventId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.event.deleteMany({ where: { id: { in: ids } } });
  });

  test("SCRUM-126 [AC1, AC3, AC4, AC5, AC6] TC-126-08: the Coordinator rejects as a new request; the Organiser cannot amend it but starts a new Draft from it", async ({
    page,
  }) => {
    const reason = "This is a different event now — please submit it fresh.";

    // --- Coordinator rejects, choosing "Submit as a new request" (AC1) -----
    await signIn(page, "coordinator@test.local");
    const coordinatorRow = page.getByRole("row", {
      name: new RegExp(eventName),
    });
    await coordinatorRow
      .getByRole("button", { name: "Reject", exact: true })
      .click();
    const rejectDialog = page.getByRole("dialog", {
      name: /Reject event request/i,
    });
    const rejectButton = rejectDialog.getByRole("button", {
      name: "Reject request",
    });
    await rejectDialog.getByLabel("Rejection reason").fill(reason);
    await expect(rejectButton).toBeDisabled();
    await rejectDialog.getByLabel("Submit as a new request").check();
    await rejectButton.click();
    await expect(coordinatorRow.getByTestId("status-badge")).toHaveAttribute(
      "data-status",
      "REJECTED",
    );

    // The outcome is in the history, by that Coordinator (AC6).
    const rejected = await prisma.event.findFirstOrThrow({
      where: { name: eventName },
      select: { id: true, rejectionOutcome: true },
    });
    expect(rejected.rejectionOutcome).toBe("NEW_REQUEST");
    expect(
      await prisma.auditLog.findMany({
        where: { entityId: rejected.id, fieldName: "rejectionOutcome" },
        select: { actorId: true, newValue: true },
      }),
    ).toEqual([{ actorId: "usr_coordinator", newValue: "NEW_REQUEST" }]);

    // --- Organiser sees the reason and outcome, and no Amend (AC3, AC5) ---
    await signIn(page, "organiser@test.local");
    const rejectedRow = page.getByRole("row", { name: new RegExp(eventName) });
    await expect(rejectedRow.getByTestId("amend-rejected-button")).toHaveCount(
      0,
    );
    await rejectedRow.getByTestId("view-details-button").click();
    // SCRUM-208 AC2: the outcome and reason are at the top of the page.
    const details = page.getByTestId("next-step");
    await expect(details.getByText(reason)).toBeVisible();
    await expect(details.getByTestId("rejection-outcome")).toHaveText(
      "Next step: Submit as a new request",
    );
    await page.getByRole("link", { name: "Back to My Events" }).click();

    // --- Organiser starts a new Draft from it (AC4) -----------------------
    await rejectedRow.getByTestId("start-new-request-button").click();
    await expect(
      page.getByText("A new draft was started from this request."),
    ).toBeVisible();
    // The new draft opens straight away for editing; close it unchanged.
    const editor = page.getByRole("heading", {
      name: /Resume Draft Event Request/,
    });
    await expect(editor).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(editor).toHaveCount(0);
    const draftRow = page.getByRole("row", { name: new RegExp(eventName) });
    await expect(draftRow.getByTestId("status-badge")).toHaveAttribute(
      "data-status",
      "DRAFT",
    );

    // Starting again shows the Draft already started instead of a copy (AC4).
    await page.getByRole("button", { name: /^All \(/ }).click();
    // Two rows share the name now; the rejected one is the one with the button.
    await page
      .getByRole("row", { name: new RegExp(eventName) })
      .filter({ has: page.getByTestId("start-new-request-button") })
      .getByTestId("start-new-request-button")
      .click();
    await expect(
      page.getByText(
        "A new request was already started from this one. Find it in your events list.",
      ),
    ).toBeVisible();
    // It is still a draft, so the same draft opens again: no copy was made.
    await expect(editor).toBeVisible();
    await page.keyboard.press("Escape");

    // The Draft carries the details but not the decision, and the rejected
    // event is untouched (AC3, AC4).
    const events = await prisma.event.findMany({
      where: { name: eventName },
      select: {
        status: true,
        coordinatorId: true,
        decisionReason: true,
        expectedAttendance: true,
        venueRequirements: true,
      },
      orderBy: { createdAt: "asc" },
    });
    expect(events).toEqual([
      {
        status: "REJECTED",
        coordinatorId: "usr_coordinator",
        decisionReason: reason,
        expectedAttendance: 80,
        venueRequirements: "Any hall",
      },
      {
        status: "DRAFT",
        coordinatorId: null,
        decisionReason: null,
        expectedAttendance: 80,
        venueRequirements: "Any hall",
      },
    ]);
  });
});
