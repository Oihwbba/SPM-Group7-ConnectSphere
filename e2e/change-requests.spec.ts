import { test, expect, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-41 — an Organiser raises a change request on their Planning event and
 * tracks it; the assigned Coordinator raises one on an Organiser's behalf.
 * Each journey has its own throwaway Organiser and event, assigned to the
 * second seeded Coordinator, so a retry starts from the same state and no
 * other spec's events are touched. Everything is removed afterwards.
 */
const STAMP = Date.now();
const ORGANISER = `usr_cr_org_${STAMP}`;
const COORDINATOR_EMAIL = "coordinator2@test.local";
const COORDINATOR = "usr_coordinator_2";
const START = new Date("2032-06-01T01:00:00Z");
const END = new Date("2032-06-01T09:00:00Z");

async function planningEvent(name: string) {
  await prisma.user.upsert({
    where: { id: ORGANISER },
    update: {},
    create: {
      id: ORGANISER,
      email: `${ORGANISER}@test.local`,
      name: "Rhea Requester",
      role: "ORGANISER",
      passwordHash: await bcrypt.hash("Password123!", 10),
    },
  });
  // A retry starts again from an event with no change requests.
  await prisma.event.deleteMany({ where: { name } });
  const { id } = await prisma.event.create({
    data: {
      name,
      status: "PLANNING",
      organiserId: ORGANISER,
      coordinatorId: COORDINATOR,
      submittedAt: new Date(),
      startAt: START,
      endAt: END,
      expectedAttendance: 40,
      description: "Booths and talks.",
    },
    select: { id: true },
  });
  return id;
}

async function openEvent(page: Page, name: string) {
  await page.goto("/events");
  await page
    .getByRole("row", { name: new RegExp(name) })
    .getByTestId("view-details-button")
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name })).toBeVisible();
  return dialog;
}

test.describe("SCRUM-41 — Raise and track a change request", () => {
  test.skip(!usesLocalDatabase, "writes change requests; local database only");

  test.afterAll(async () => {
    const events = await prisma.event.findMany({
      where: { organiserId: ORGANISER },
      select: { id: true },
    });
    const ids = events.map((e) => e.id);
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { eventId: { in: ids } } });
    await prisma.event.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: ORGANISER } });
  });

  test("SCRUM-41 [AC1, AC4, AC5, AC6, AC7] TC-41-07, TC-41-09: an invalid value is refused next to its field; a valid request shows as Submitted and no second one is offered", async ({
    browser,
  }) => {
    const name = `SCRUM-41 Fair ${STAMP}`;
    const eventId = await planningEvent(name);
    const page = await signedIn(browser, `${ORGANISER}@test.local`);
    const dialog = await openEvent(page, name);

    await expect(dialog.getByText("No change requests yet.")).toBeVisible();
    await dialog.getByRole("button", { name: "Request a change" }).click();
    const form = dialog.getByRole("form", { name: "Request a change" });
    const attendance = form.getByLabel("Expected attendance");

    // AC4: the request form's rule, shown next to the field; nothing is saved.
    await attendance.fill("0");
    await form.getByRole("button", { name: "Submit change request" }).click();
    await expect(form.getByText("Attendance must be a positive whole number.")).toBeVisible();
    await expect(attendance).toHaveAttribute("aria-invalid", "true");
    expect(await prisma.eventChangeRequest.count({ where: { eventId } })).toBe(0);

    // AC4: the request form's catalogue suggestions, filling the same field.
    const venue = form.getByLabel("Venue requirements", { exact: true });
    await form
      .getByRole("button", { name: /^Add .+ to venue requirements$/ })
      .first()
      .click();
    await expect(venue).toHaveValue(/^Preferred venue: \S/);

    await attendance.fill("60");
    await form.getByLabel("Reason (optional)").fill("More companies signed up.");
    await form.getByRole("button", { name: "Submit change request" }).click();

    const request = dialog.getByTestId("change-request");
    await expect(request).toHaveCount(1);
    await expect(request).toContainText("Submitted");
    await expect(request).toContainText("Expected attendance");
    await expect(request).toContainText("Impactful");
    await expect(request).toContainText("40 → 60");
    await expect(request).toContainText("Venue requirements");
    await expect(request).toContainText("More companies signed up.");
    // AC7: one Submitted request at a time.
    await expect(dialog.getByRole("button", { name: "Request a change" })).toHaveCount(0);
    // AC6: the event keeps its own values until the request is decided.
    await expect(dialog.getByText("40 attendees")).toBeVisible();
    expect(
      await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { expectedAttendance: true },
      }),
    ).toEqual({ expectedAttendance: 40 });
  });

  test("SCRUM-41 [AC1, AC9] TC-41-02, TC-41-13: the assigned Coordinator asks to cancel on the Organiser's behalf, and the Organiser sees it labelled", async ({
    browser,
  }) => {
    const name = `SCRUM-41 Gala ${STAMP}`;
    await planningEvent(name);

    const coordinator = await signedIn(browser, COORDINATOR_EMAIL);
    const dialog = await openEvent(coordinator, name);
    await dialog.getByRole("button", { name: "Request a change" }).click();
    const form = dialog.getByRole("form", { name: "Request a change" });
    await form.getByLabel("Ask to cancel the event instead").check();

    // AC1: a cancellation needs its reason.
    await form.getByRole("button", { name: "Submit change request" }).click();
    await expect(form.getByText("Give a reason for cancelling the event.")).toBeVisible();

    await form.getByLabel("Reason for cancelling").fill("The organiser called: the sponsor withdrew.");
    await form.getByRole("button", { name: "Submit change request" }).click();
    await expect(dialog.getByTestId("change-request")).toContainText(
      "Asks for the event to be cancelled.",
    );

    const organiser = await signedIn(browser, `${ORGANISER}@test.local`);
    const seen = (await openEvent(organiser, name)).getByTestId("change-request");
    await expect(seen).toContainText("Submitted");
    await expect(seen).toContainText("Raised by Coordinator for Rhea Requester");
    await expect(seen).toContainText("The organiser called: the sponsor withdrew.");
  });
});
