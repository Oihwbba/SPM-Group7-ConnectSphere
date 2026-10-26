import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

/**
 * SCRUM-18 — the clarification journey: the coordinator asks, the organiser
 * replies, the coordinator sees the answer. Each test owns its event (created
 * straight in the database) so it cannot collide with the seeded events other
 * specs reset and decide on. It writes to the database, so like the other
 * writing specs it only runs against a localhost database.
 */
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/events");
}

test.describe("SCRUM-18 — Request clarification on a submitted request", () => {
  test.skip(!usesLocalDatabase, "writes its own event; local database only");

  let eventId: string;
  let eventName: string;

  test.beforeEach(async () => {
    eventName = `SCRUM-18 Clarification ${Date.now()}`;
    const event = await prisma.event.create({
      data: {
        name: eventName,
        purpose: "Clarification journey",
        description: "Owned by the SCRUM-18 e2e spec.",
        status: "UNDER_REVIEW",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        startAt: new Date("2031-06-01T02:00:00Z"),
        endAt: new Date("2031-06-01T10:00:00Z"),
        expectedAttendance: 60,
        venueRequirements: "Any room",
        requiredFacilities: [],
        accessibilityNeeds: "None",
        preferredLayout: "Classroom",
        equipmentRequirements: "None",
        registrationNotes: "None",
        submittedAt: new Date(),
      },
      select: { id: true },
    });
    eventId = event.id;
  });

  test.afterEach(async () => {
    await prisma.notification.deleteMany({ where: { eventId } });
    await prisma.auditLog.deleteMany({ where: { entityId: eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
  });

  test("coordinator asks, organiser replies, coordinator sees the answer (AC: sub-state, notify, respond, re-review)", async ({
    page,
  }) => {
    const question = "Can you confirm the expected headcount?";
    const answer = "We expect about 60 attendees.";

    // --- Coordinator asks -------------------------------------------------
    await signIn(page, "coordinator@test.local");
    const coordinatorRow = page.getByRole("row", { name: new RegExp(eventName) });
    await expect(coordinatorRow).toBeVisible();

    await coordinatorRow.getByRole("button", { name: "Ask" }).click();
    const askDialog = page.getByRole("dialog", { name: /Request clarification/i });
    await expect(askDialog).toBeVisible();

    // Failure path: nothing to send until there is a real message.
    const send = askDialog.getByRole("button", { name: "Send request" });
    await expect(send).toBeDisabled();
    await askDialog.getByLabel("Clarification message").fill("   ");
    await expect(send).toBeDisabled();

    await askDialog.getByLabel("Clarification message").fill(question);
    await expect(send).toBeEnabled();
    await send.click();

    await expect(
      page.getByText("Clarification request sent to the organiser."),
    ).toBeVisible();
    await expect(askDialog).not.toBeVisible();

    // AC: the event remains "under review" — no tenth status.
    await expect(coordinatorRow.getByTestId("status-badge")).toHaveAttribute(
      "data-status",
      "UNDER_REVIEW",
    );

    // AC: awaiting the organiser is shown on the request, not as a status.
    await coordinatorRow.getByTestId("view-details-button").click();
    const coordinatorDetails = page.getByRole("dialog");
    // The thread is the details' second tab (shared page conventions, change 2).
    await coordinatorDetails.getByRole("tab", { name: /Clarification/ }).click();
    await expect(coordinatorDetails.getByText(question)).toBeVisible();
    await expect(
      coordinatorDetails.getByText("Waiting for the organiser's response."),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // AC: a second open clarification on the same event is refused.
    await coordinatorRow.getByRole("button", { name: "Ask" }).click();
    await askDialog.getByLabel("Clarification message").fill("A second question");
    await askDialog.getByRole("button", { name: "Send request" }).click();
    await expect(
      page.getByText("There is already an open clarification request on this event."),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // --- Organiser sees the question and replies --------------------------
    await signIn(page, "organiser@test.local");
    const organiserRow = page.getByRole("row", { name: new RegExp(eventName) });
    await expect(organiserRow).toBeVisible();
    await organiserRow.getByTestId("view-details-button").click();

    const organiserDetails = page.getByRole("dialog");
    // The thread is the details' second tab (shared page conventions, change 2).
    await organiserDetails.getByRole("tab", { name: /Clarification/ }).click();
    await expect(organiserDetails.getByText(question)).toBeVisible();

    // Failure path: an empty reply cannot be sent.
    const sendResponse = organiserDetails.getByRole("button", { name: "Send response" });
    await expect(sendResponse).toBeDisabled();

    await organiserDetails.getByLabel("Response to clarification").fill(answer);
    await sendResponse.click();
    await expect(page.getByText("Response sent to the coordinator.")).toBeVisible();
    await expect(organiserDetails.getByText("Organiser responded:")).toBeVisible();
    await expect(organiserDetails.getByText(answer)).toBeVisible();
    await expect(sendResponse).not.toBeVisible();
    await page.keyboard.press("Escape");

    // --- Coordinator sees the answer and can re-review --------------------
    await signIn(page, "coordinator@test.local");
    const reviewRow = page.getByRole("row", { name: new RegExp(eventName) });
    await reviewRow.getByTestId("view-details-button").click();
    const reviewDetails = page.getByRole("dialog");
    // The thread is the details' second tab (shared page conventions, change 2).
    await reviewDetails.getByRole("tab", { name: /Clarification/ }).click();
    await expect(reviewDetails.getByText("Organiser responded:")).toBeVisible();
    await expect(reviewDetails.getByText(answer)).toBeVisible();
    await page.keyboard.press("Escape");

    // The request is still reviewable: the decision buttons are still there.
    await expect(reviewRow.getByRole("button", { name: "Approve" })).toBeVisible();
  });
});
