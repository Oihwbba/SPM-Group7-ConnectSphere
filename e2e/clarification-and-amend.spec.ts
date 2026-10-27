import { test, expect, type Page, type Route } from "@playwright/test";
import { prisma } from "@/lib/db";

import { usesLocalDatabase, fillOther, pickDateTime, submitRequest, openEvent } from "./helpers";

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
  // SCRUM-171 AC2: resubmitting needs Registration needed answered.
  registrationRequired: true,
  registrationNotes: "None",
  submittedAt: new Date(),
});

test.describe("SCRUM-108 — Answer a clarification, or amend and resubmit", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  let eventId: string | undefined;

  test.afterEach(async () => {
    // Unset if the event was never made: with no id, deleteMany would match
    // every row, other suites' included.
    if (!eventId) return;
    await prisma.notification.deleteMany({ where: { eventId } });
    await prisma.auditLog.deleteMany({ where: { entityId: eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
    eventId = undefined;
  });

  test("SCRUM-108 [AC1, AC2, AC3, AC14] TC-108-10: the Coordinator lets the Organiser change the attendance, and the answer changes only that", async ({
    page,
  }) => {
    // SCRUM-189: a long journey, two sign-ins, a refused answer and an accepted one.
    // Three times the 30-second limit, not a retry under CI load.
    test.slow();
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
    // SCRUM-208 AC3: the thread is the event page's Clarification tab, and
    // it says in plain words what the answer may also update.
    const details = await openEvent(page, name, "Clarification");
    await expect(details.getByTestId("clarification-fields")).toHaveText(
      "You can also update: Expected attendance.",
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
    // SCRUM-189: a long journey, the whole form to amend, with a refused step.
    // Three times the 30-second limit, not a retry under CI load.
    test.slow();
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
    await pickDateTime(start, "2020-01-01T10:00");
    await pickDateTime(end, "2020-01-01T12:00");
    await next.click();
    await expect(
      page.getByText("Proposed date cannot be in the past."),
    ).toBeVisible();
    // Back to the request's own dates (10:00–18:00 SGT on 1 Aug 2031).
    await pickDateTime(start, "2031-08-01T10:00");
    await pickDateTime(end, "2031-08-01T18:00");
    await next.click();
    await fillOther(
      page.getByLabel("Venue Requirements *"),
      "Any hall — a different date is fine.",
    );
    await expect(page.getByTestId("amend-rejection-reason")).toContainText(
      reason,
    );
    for (let i = 0; i < 3; i++) await next.click();
    await submitRequest(page);
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

/**
 * SCRUM-187 — an answer whose send gets no reply doesn't strand the form on
 * "Sending…". Test cases: docs/testing/SCRUM-187.md.
 */
test.describe("SCRUM-187 — A clarification answer that gets no reply", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  const SEND_FAILED =
    "Your response couldn't be sent. If it isn't shown as answered above, try again.";
  let eventId: string | undefined;

  test.afterEach(async () => {
    // Unset if the event was never made: with no id, deleteMany would match
    // every row, other suites' included.
    if (!eventId) return;
    await prisma.notification.deleteMany({ where: { eventId } });
    await prisma.auditLog.deleteMany({ where: { entityId: eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
    eventId = undefined;
  });

  /** An event Under Review with an open, text-only question, open for the Organiser. */
  async function openQuestion(page: Page, label: string) {
    const name = `SCRUM-187 ${label} ${Date.now()}`;
    eventId = (
      await prisma.event.create({
        data: {
          ...request(name),
          status: "UNDER_REVIEW",
          clarificationRequests: {
            create: {
              requestedById: "usr_coordinator",
              message: "Is the date fixed?",
            },
          },
        },
        select: { id: true },
      })
    ).id;
    await signIn(page, "organiser@test.local");
    // SCRUM-208 AC3: the thread is the event page's Clarification tab.
    const details = await openEvent(page, name, "Clarification");
    await details.getByLabel("Response to clarification").fill("Yes, it is fixed.");
    return details;
  }

  const isServerAction = (route: Route) =>
    route.request().method() === "POST" &&
    Boolean(route.request().headers()["next-action"]);

  const answers = () =>
    prisma.auditLog.count({
      where: { entityId: eventId, action: "CLARIFICATION_ANSWERED" },
    });

  test("SCRUM-187 [AC1, AC4] TC-187-01: a send that never reaches the server says so, and the same answer can be sent again", async ({
    page,
  }) => {
    const details = await openQuestion(page, "Dropped");
    // Drop the next server action, the send, as a lost connection would.
    let dropNext = true;
    await page.route("**/*", (route) => {
      if (dropNext && isServerAction(route)) {
        dropNext = false;
        return route.abort("failed");
      }
      return route.continue();
    });
    const send = details.getByRole("button", { name: "Send response" });
    await send.click();

    await expect(details.getByRole("alert")).toHaveText(SEND_FAILED);
    await expect(send).toBeEnabled();
    expect(
      await prisma.clarificationRequest.findFirstOrThrow({
        where: { eventId },
        select: { status: true },
      }),
    ).toEqual({ status: "OPEN" });
    expect(await answers()).toBe(0);

    await send.click();
    await expect(page.getByText("Response sent to the coordinator.")).toBeVisible();
    await expect(details.getByRole("alert")).toHaveCount(0);
    expect(await answers()).toBe(1);
  });

  test("SCRUM-187 [AC2, AC4] TC-187-02: an answer saved whose reply is lost shows as answered, so it isn't sent twice", async ({
    page,
  }) => {
    const details = await openQuestion(page, "Saved");
    // Let the send reach the server and be saved, then lose its reply.
    let loseNext = true;
    await page.route("**/*", async (route) => {
      if (loseNext && isServerAction(route)) {
        loseNext = false;
        await route.fetch();
        return route.abort("failed");
      }
      return route.continue();
    });
    await details.getByRole("button", { name: "Send response" }).click();

    // The send ends with no reply, and the thread is read again: the saved
    // answer replaces the form, under the Organiser's name. The answer box
    // goes only once that re-read finds it answered; the typed answer, or the
    // button reading "Sending…", would pass before the server had saved it.
    await expect(details.getByLabel("Response to clarification")).toHaveCount(0);
    await expect(details.getByTestId("clarification-thread")).toContainText("Olivia Organiser");
    await expect(details.getByTestId("clarification-thread")).toContainText("Yes, it is fixed.");
    expect(
      await prisma.clarificationRequest.findFirstOrThrow({
        where: { eventId },
        select: { status: true, response: true },
      }),
    ).toEqual({ status: "ANSWERED", response: "Yes, it is fixed." });
    expect(await answers()).toBe(1);
  });
});
