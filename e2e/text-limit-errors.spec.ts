import { test, expect, type Locator, type Page } from "@playwright/test";
import type { EventStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

import { openBooking, openEvent, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-264 — over 2,000 characters in a text box shows why next to the box,
 * and the form stays open with the text (SCRUM-132 AC4, TC-132-09). Each test
 * creates its own event straight in the database. Test cases:
 * docs/testing/SCRUM-264.md.
 */

async function signIn(page: Page, email: string, landing: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`**${landing}`);
}

const OVER_LIMIT = "x".repeat(2001);
const REJECTION = "Keep the rejection reason under 2000 characters.";
const PERIOD = {
  startAt: new Date("2033-03-01T02:00:00Z"),
  endAt: new Date("2033-03-01T06:00:00Z"),
};

let eventId: string;

async function event(name: string, status: EventStatus) {
  const created = await prisma.event.create({
    data: {
      name,
      purpose: "SCRUM-264 journey",
      description: "Owned by the SCRUM-264 e2e spec.",
      status,
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      ...PERIOD,
      expectedAttendance: 40,
      submittedAt: new Date(),
    },
    select: { id: true },
  });
  eventId = created.id;
}

async function changeRequest() {
  return prisma.eventChangeRequest.create({
    data: {
      eventId,
      requestedById: "usr_organiser",
      reason: "More people signed up.",
      fields: {
        create: [{ fieldName: "expectedAttendance", oldValue: "40", newValue: "60", isMajor: false }],
      },
    },
    select: { id: true },
  });
}

/**
 * Send 2,001 characters from `box`: the form stays open with the text, the box
 * is marked and `message` shows inside `form`; shortening it clears both.
 */
async function expectRefusedAtTheBox(
  box: Locator,
  send: Locator,
  form: Locator,
  message: string,
) {
  await box.fill(OVER_LIMIT);
  await send.click();

  const shown = form.getByText(message);
  await expect(shown).toBeVisible();
  await expect(box).toHaveAttribute("aria-invalid", "true");
  await expect(box).toHaveAccessibleDescription(message);
  await expect(box).toHaveValue(OVER_LIMIT);

  await box.fill("x".repeat(2000));
  await expect(shown).toHaveCount(0);
  await expect(box).toHaveAttribute("aria-invalid", "false");
}

test.describe("SCRUM-264 — text over 2,000 characters is refused at the box", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  test.afterEach(async () => {
    const bookings = await prisma.booking.findMany({ where: { eventId }, select: { id: true } });
    const checks = await prisma.safetyCheck.findMany({ where: { eventId }, select: { id: true } });
    const requests = await prisma.eventChangeRequest.findMany({
      where: { eventId },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({
      where: {
        entityId: {
          in: [eventId, ...[...bookings, ...checks, ...requests].map((row) => row.id)],
        },
      },
    });
    await prisma.notification.deleteMany({ where: { eventId } });
    await prisma.safetyCheck.deleteMany({ where: { eventId } });
    await prisma.booking.deleteMany({ where: { eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
  });

  test("SCRUM-264 [AC1, AC2] TC-264-01: asking for clarification", async ({ page }) => {
    const name = `SCRUM-264 Ask ${Date.now()}`;
    await event(name, "UNDER_REVIEW");

    await signIn(page, "coordinator@test.local", "/events");
    const details = await openEvent(page, name);
    await details.getByRole("button", { name: "Ask", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Request clarification" });

    await expectRefusedAtTheBox(
      dialog.getByLabel("Clarification message"),
      dialog.getByRole("button", { name: "Send request" }),
      dialog,
      "Keep the message under 2000 characters.",
    );
    expect(await prisma.clarificationRequest.count({ where: { eventId } })).toBe(0);
  });

  test("SCRUM-264 [AC1, AC2] TC-264-01: rejecting an event request", async ({ page }) => {
    const name = `SCRUM-264 Review ${Date.now()}`;
    await event(name, "UNDER_REVIEW");

    await signIn(page, "coordinator@test.local", "/events");
    const details = await openEvent(page, name);
    await details.getByRole("button", { name: "Reject", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Reject event request" });
    await dialog.getByLabel("Amend and resubmit").check();

    await expectRefusedAtTheBox(
      dialog.getByLabel("Rejection reason"),
      dialog.getByRole("button", { name: "Reject request" }),
      dialog,
      REJECTION,
    );
    expect(await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({
      status: "UNDER_REVIEW",
      decisionReason: null,
    });
  });

  test("SCRUM-264 [AC1, AC2] TC-264-01: rejecting a Planning event", async ({ page }) => {
    const name = `SCRUM-264 Planning ${Date.now()}`;
    await event(name, "PLANNING");

    await signIn(page, "coordinator@test.local", "/events");
    const details = await openEvent(page, name, "Arrangements");
    await details.getByRole("button", { name: "Reject event" }).click();
    const dialog = page.getByRole("dialog", { name: /Reject this event/ });
    await dialog.getByLabel("Amend and resubmit").check();

    await expectRefusedAtTheBox(
      dialog.getByLabel("Rejection reason"),
      dialog.getByRole("button", { name: "Reject event" }),
      dialog,
      REJECTION,
    );
    expect(await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({
      status: "PLANNING",
      decisionReason: null,
    });
  });

  test("SCRUM-264 [AC1, AC2] TC-264-01: cancelling an event", async ({ page }) => {
    const name = `SCRUM-264 Cancel ${Date.now()}`;
    await event(name, "CONFIRMED");

    await signIn(page, "coordinator@test.local", "/events");
    const details = await openEvent(page, name);
    await details.getByRole("button", { name: "Cancel event" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancel this event" });

    await expectRefusedAtTheBox(
      dialog.getByLabel("Cancellation reason"),
      dialog.getByRole("button", { name: "Cancel event" }),
      dialog,
      "Keep the cancellation reason under 2000 characters.",
    );
    expect(await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({
      status: "CONFIRMED",
      cancellationReason: null,
    });
  });

  test("SCRUM-264 [AC1, AC2] TC-264-01, TC-264-05: rejecting a change request; the text left by Back doesn't stop an approval", async ({
    page,
  }) => {
    const name = `SCRUM-264 Change ${Date.now()}`;
    await event(name, "CONFIRMED");
    const { id } = await changeRequest();

    await signIn(page, "coordinator@test.local", "/events");
    const details = await openEvent(page, name, "Changes");
    const decision = details.getByTestId("change-request-decision");
    await decision.getByRole("button", { name: "Reject", exact: true }).click();

    const box = decision.getByLabel("Reason for rejecting the change request");
    await expectRefusedAtTheBox(
      box,
      decision.getByRole("button", { name: "Reject change request" }),
      decision,
      REJECTION,
    );
    expect(await prisma.eventChangeRequest.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: "PENDING_REVIEW",
      decisionReason: null,
    });

    await box.fill(OVER_LIMIT);
    await decision.getByRole("button", { name: "Back" }).click();
    await decision.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Change request approved and applied.")).toBeVisible();
    expect(await prisma.eventChangeRequest.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: "APPROVED",
    });
  });

  test("SCRUM-264 [AC1, AC2] TC-264-01: rejecting a booking request", async ({ page }) => {
    const name = `SCRUM-264 Booking ${Date.now()}`;
    await event(name, "PLANNING");
    const booking = await prisma.booking.create({
      data: {
        eventId,
        venueId: "ven_hall",
        ...PERIOD,
        status: "PENDING",
        requestedById: "usr_coordinator",
      },
      select: { id: true },
    });

    await signIn(page, "venuestaff@test.local", "/bookings");
    const details = await openBooking(page, { id: booking.id });
    await details.getByRole("button", { name: "Reject" }).click();
    const dialog = page.getByRole("dialog", { name: "Reject booking request" });

    await expectRefusedAtTheBox(
      dialog.getByLabel("Rejection reason"),
      dialog.getByRole("button", { name: "Reject request" }),
      dialog,
      REJECTION,
    );
    expect(
      await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }),
    ).toMatchObject({ status: "PENDING", decisionReason: null });
  });

  test("SCRUM-264 [AC1, AC2] TC-264-01: recording a safety check's note", async ({ page }) => {
    const name = `SCRUM-264 Safety ${Date.now()}`;
    await event(name, "PLANNING");
    const check = await prisma.safetyCheck.create({
      data: { eventId, requestedById: "usr_coordinator" },
      select: { id: true },
    });

    await signIn(page, "safety@test.local", "/safety-checks");
    await page.getByRole("link", { name: new RegExp(name) }).click();
    // SCRUM-211: the outcome is recorded from the queue's decision panel, so
    // Reject asks in the shared dialog and the note is written there.
    await page.getByRole("button", { name: "Reject" }).click();
    const dialog = page.getByRole("dialog", {
      name: "Reject this safety check?",
    });

    await expectRefusedAtTheBox(
      dialog.getByLabel(/^Note/),
      dialog.getByRole("button", { name: "Reject" }),
      dialog,
      "Keep the note under 2000 characters.",
    );
    expect(
      await prisma.safetyCheck.findUniqueOrThrow({ where: { id: check.id } }),
    ).toMatchObject({ status: "AWAITING_REVIEW", note: null });
  });
});
