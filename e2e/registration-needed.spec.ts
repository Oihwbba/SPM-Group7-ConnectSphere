import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { usesLocalDatabase } from "./helpers";

/**
 * SCRUM-171 — Registration needed in a real browser. Attendees don't see an
 * event that doesn't need registration, in the list or by its URL, while one
 * that does is listed. An event requested before the choice existed reads
 * "Not answered", with its own registration answer beside it. Each test makes
 * its own events and removes them afterwards. Test cases:
 * docs/testing/SCRUM-171.md.
 */

const PREFIX = "E2E SCRUM-171";

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/events");
}

// A worker runs one test at a time, so these are the running test's events.
// Each test removes only its own: tests in this file may run at once.
let created: string[] = [];

async function event(name: string, data: Record<string, unknown>) {
  const id = (
    await prisma.event.create({
      data: {
        name,
        purpose: "SCRUM-171 journey",
        description: "Owned by the SCRUM-171 e2e spec.",
        status: "CONFIRMED",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        startAt: new Date("2035-02-14T02:00:00Z"),
        endAt: new Date("2035-02-14T06:00:00Z"),
        expectedAttendance: 40,
        registrationEnabled: true,
        submittedAt: new Date(),
        ...data,
      },
      select: { id: true },
    })
  ).id;
  created.push(id);
  return id;
}

test.describe("SCRUM-171 — Record whether an event needs registration", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  test.afterEach(async () => {
    await prisma.event.deleteMany({ where: { id: { in: created } } });
    created = [];
  });

  test("SCRUM-171 [AC4] TC-171-06: an Attendee sees an event that needs registration, but not one that doesn't, in the list or by its URL", async ({
    page,
  }) => {
    const stamp = Date.now();
    const needed = `${PREFIX} Open Day ${stamp}`;
    const notNeeded = `${PREFIX} Board Dinner ${stamp}`;
    await event(needed, { registrationRequired: true });
    const hiddenId = await event(notNeeded, { registrationRequired: false });

    await signIn(page, "attendee@test.local");

    const cards = page.getByTestId("browsable-event-card");
    await expect(cards.filter({ hasText: needed })).toHaveCount(1);
    await expect(cards.filter({ hasText: notNeeded })).toHaveCount(0);

    // SCRUM-72 AC8: the URL follows the list, as for an event that doesn't exist.
    const response = await page.goto(`/events/${hiddenId}`);
    expect(response?.status()).toBe(404);
  });

  test("SCRUM-171 [AC3] TC-171-04: a request made before the choice existed reads Not answered, with its own registration answer beside it, and its Coordinator's edit keeps both", async ({
    page,
  }) => {
    const name = `${PREFIX} Legacy Talk ${Date.now()}`;
    // Under Review with its Coordinator, so step 2 can open Edit details
    // (SCRUM-25 AC1).
    await event(name, {
      status: "UNDER_REVIEW",
      registrationRequired: null,
      registrationNotes: "Walk-in, no sign-up needed",
    });

    await signIn(page, "organiser@test.local");
    await page
      .getByRole("row", { name: new RegExp(name) })
      .getByTestId("view-details-button")
      .click();

    const answer = page.getByRole("dialog").getByTestId("registration-needed");
    await expect(answer).toContainText("Registration Needed:");
    await expect(answer).toContainText("Not answered");
    await expect(answer).toContainText("Walk-in, no sign-up needed");

    // Step 2: the Coordinator's Edit details picks neither answer for them,
    // and keeps the note.
    await signIn(page, "coordinator@test.local");
    await page
      .getByRole("row", { name: new RegExp(name) })
      .getByTestId("view-details-button")
      .click();
    await page
      .getByRole("dialog", { name, exact: true })
      .getByRole("button", { name: "Edit details" })
      .click();
    const edit = page.getByRole("dialog", { name: `Edit ${name}` });
    const needed = edit.getByRole("group", { name: "Registration needed" });
    await expect(needed.getByRole("radio", { name: "Yes" })).not.toBeChecked();
    await expect(needed.getByRole("radio", { name: "No" })).not.toBeChecked();
    await expect(edit.getByLabel("Registration notes")).toHaveValue(
      "Walk-in, no sign-up needed",
    );
  });
});
