import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { usesLocalDatabase } from "./helpers";

/**
 * SCRUM-82 — closing an event: the assigned Coordinator cancels it with a
 * reason everyone involved can see, an overdue request is marked in the
 * Coordinator's list, and a finished event reads as Completed without a job.
 * Each test creates its own events straight in the database. Test cases:
 * docs/testing/SCRUM-82.md.
 */

async function signIn(page: Page, email: string, landing: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`**${landing}`);
}

const row = (page: Page, name: string) => page.getByRole("row", { name: new RegExp(name) });

async function openDetails(page: Page, name: string) {
  await row(page, name).getByTestId("view-details-button").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ids: string[] = [];

async function event(
  name: string,
  status: "PLANNING" | "CONFIRMED",
  startAt: Date,
  endAt: Date,
) {
  const created = await prisma.event.create({
    data: {
      name,
      purpose: "SCRUM-82 journey",
      description: "Owned by the SCRUM-82 e2e spec.",
      status,
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      startAt,
      endAt,
      expectedAttendance: 30,
      submittedAt: new Date(),
      registrationEnabled: status === "CONFIRMED",
    },
    select: { id: true },
  });
  ids.push(created.id);
  return created.id;
}

test.describe("SCRUM-82 — Close an event", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  test.afterEach(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { eventId: { in: ids } } });
    await prisma.registration.deleteMany({ where: { eventId: { in: ids } } });
    await prisma.event.deleteMany({ where: { id: { in: ids } } });
    ids.length = 0;
  });

  test("SCRUM-82 [AC1, AC3, AC4] TC-82-12: the Coordinator cancels a Confirmed event with a reason; the Organiser and the registered Attendee see it", async ({
    page,
  }) => {
    const name = `SCRUM-82 Cancel ${Date.now()}`;
    const REASON = "The keynote speaker withdrew.";
    const start = new Date(Date.now() + 40 * DAY_MS);
    const eventId = await event(name, "CONFIRMED", start, new Date(start.getTime() + 4 * 3_600_000));
    await prisma.registration.create({ data: { eventId, userId: "usr_attendee" } });

    await signIn(page, "coordinator@test.local", "/events");
    let dialog = await openDetails(page, name);
    await dialog.getByRole("button", { name: "Cancel event" }).click();
    const confirm = page.getByRole("dialog", { name: "Cancel this event" });

    // Failure path (AC1): no reason, no cancellation.
    await expect(confirm.getByRole("button", { name: "Cancel event" })).toBeDisabled();
    await confirm.getByLabel("Cancellation reason").fill(REASON);
    await confirm.getByRole("button", { name: "Cancel event" }).click();
    await expect(
      page.getByText("Event cancelled. Its arrangements and registrations were released."),
    ).toBeVisible();

    // AC3, AC4: Cancelled, the registration with it, and no way back.
    expect(await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({
      status: "CANCELLED",
      cancellationReason: REASON,
    });
    expect((await prisma.registration.findFirstOrThrow({ where: { eventId } })).status).toBe(
      "CANCELLED",
    );
    await page.keyboard.press("Escape");
    dialog = await openDetails(page, name);
    await expect(dialog.getByTestId("cancellation-reason")).toContainText(REASON);
    await expect(dialog.getByRole("button", { name: "Cancel event" })).toHaveCount(0);

    // AC1: the Organiser sees the reason.
    await signIn(page, "organiser@test.local", "/events");
    dialog = await openDetails(page, name);
    await expect(dialog.getByTestId("cancellation-reason")).toContainText(REASON);

    // AC1: so does the registered Attendee.
    await signIn(page, "attendee@test.local", "/events");
    await page.goto("/registrations");
    const card = page.getByTestId("registration-card").filter({ hasText: name });
    await expect(card).toHaveAttribute("data-status", "CANCELLED");
    await expect(card.getByTestId("cancellation-reason")).toContainText(REASON);
  });

  test("SCRUM-82 [AC7, AC10] TC-82-13: a request whose start has passed is marked Overdue for the Coordinator, and a finished Confirmed event reads as Completed", async ({
    page,
  }) => {
    const overdue = `SCRUM-82 Overdue ${Date.now()}`;
    const finished = `SCRUM-82 Finished ${Date.now()}`;
    const upcoming = `SCRUM-82 Upcoming ${Date.now()}`;
    await event(overdue, "PLANNING", new Date(Date.now() - DAY_MS), new Date(Date.now() - DAY_MS / 2));
    const finishedId = await event(
      finished,
      "CONFIRMED",
      new Date(Date.now() - 2 * DAY_MS),
      new Date(Date.now() - DAY_MS),
    );
    await event(upcoming, "PLANNING", new Date(Date.now() + 10 * DAY_MS), new Date(Date.now() + 11 * DAY_MS));

    await signIn(page, "coordinator@test.local", "/events");
    await expect(row(page, overdue).getByTestId("overdue-badge")).toBeVisible();
    await expect(row(page, upcoming).getByTestId("overdue-badge")).toHaveCount(0);

    // AC7: loading the list completed it; no job ran.
    await expect(row(page, finished)).toHaveAttribute("data-status", "COMPLETED");
    expect((await prisma.event.findUniqueOrThrow({ where: { id: finishedId } })).status).toBe(
      "COMPLETED",
    );

    // SCRUM-45 AC7: its Coordinator and its Organiser are each told, once, in
    // their own list.
    for (const [email, landing] of [
      ["coordinator@test.local", "/events"],
      ["organiser@test.local", "/events"],
    ]) {
      await signIn(page, email, landing);
      await page.goto("/notifications");
      await expect(
        page
          .getByTestId("notification")
          .filter({ hasText: "Event completed" })
          .filter({ hasText: finished }),
      ).toHaveCount(1);
    }
  });
});
