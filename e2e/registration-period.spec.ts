import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { usesLocalDatabase, openEvent } from "./helpers";

/**
 * SCRUM-75 AC6 in a real browser: the Organiser closes registration, the
 * Attendee still sees the event, as closed and with no way to register; the
 * assigned Coordinator reopens it and the Attendee registers. Each test makes
 * its own event and removes it afterwards. Test cases:
 * docs/testing/SCRUM-75.md.
 */

const PREFIX = "E2E SCRUM-75";

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/events");
}

async function registrationPanel(page: Page, name: string) {
  // SCRUM-208: registration is on the event page's Registrations tab.
  const event = await openEvent(page, name, "Registrations");
  const panel = event.getByTestId("registration-control");
  await expect(panel).toBeVisible();
  return panel;
}

test.describe("SCRUM-75 — Control and enforce the registration period", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  test.afterEach(async () => {
    const ids = (
      await prisma.event.findMany({
        where: { name: { startsWith: PREFIX } },
        select: { id: true },
      })
    ).map((e) => e.id);
    await prisma.registration.deleteMany({ where: { eventId: { in: ids } } });
    // SCRUM-85 AC1: registering now notifies the Attendee.
    await prisma.notification.deleteMany({ where: { eventId: { in: ids } } });
    await prisma.event.deleteMany({ where: { id: { in: ids } } });
  });

  test("SCRUM-75 [AC6] TC-75-06, TC-75-07: the Organiser closes registration, the Attendee sees it closed, and after the Coordinator reopens it the Attendee registers", async ({
    page,
  }) => {
    const name = `${PREFIX} Open Day ${Date.now()}`;
    const { id } = await prisma.event.create({
      data: {
        name,
        purpose: "SCRUM-75 journey",
        description: "Owned by the SCRUM-75 e2e spec.",
        status: "CONFIRMED",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        startAt: new Date("2035-03-14T02:00:00Z"),
        endAt: new Date("2035-03-14T06:00:00Z"),
        expectedAttendance: 40,
        registrationRequired: true,
        registrationEnabled: true,
        submittedAt: new Date(),
      },
      select: { id: true },
    });

    // --- The Organiser closes it ----------------------------------------
    await signIn(page, "organiser@test.local");
    let panel = await registrationPanel(page, name);
    await expect(panel.getByTestId("registration-control-state")).toHaveText("Open");
    await panel.getByRole("button", { name: "Close registration" }).click();
    await expect(panel.getByTestId("registration-control-state")).toHaveText(
      "Registration closed",
    );
    // SCRUM-132 AC4: the change is confirmed.
    await expect(page.getByText("Registration closed.", { exact: true })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Reopen registration" })).toBeVisible();

    // --- The Attendee still sees it, as closed --------------------------
    await signIn(page, "attendee4@test.local");
    const card = page.getByTestId("browsable-event-card").filter({ hasText: name });
    await expect(card.getByTestId("registration-state-badge")).toHaveText(
      "Closed",
    );
    await page.goto(`/events/${id}`);
    await expect(page.getByTestId("registration-state-badge")).toHaveText(
      "Closed",
    );
    await expect(page.getByTestId("register-button")).toBeDisabled();

    // --- The assigned Coordinator reopens it on the Organiser's behalf --
    await signIn(page, "coordinator@test.local");
    panel = await registrationPanel(page, name);
    await panel.getByRole("button", { name: "Reopen registration" }).click();
    await expect(panel.getByTestId("registration-control-state")).toHaveText("Open");
    await expect(page.getByText("Registration reopened.", { exact: true })).toBeVisible();

    // --- The Attendee registers -----------------------------------------
    await signIn(page, "attendee4@test.local");
    await page.goto(`/events/${id}`);
    await page.getByTestId("register-button").click();
    await expect(page.getByTestId("already-registered")).toBeVisible();
  });
});
