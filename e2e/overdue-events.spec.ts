import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { openEvent, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-249 — what the Coordinator is told and offered for an overdue event.
 * The refusals themselves are in the unit and integration tests. Each test
 * creates its own event straight in the database. Test cases:
 * docs/testing/SCRUM-249.md.
 */

const CLOSE_IT = "Your turn: this event is overdue, so reject it or cancel it";
const DAY_MS = 24 * 60 * 60 * 1000;
const ids: string[] = [];

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/events");
}

async function overdueEvent(name: string, status: "UNDER_REVIEW" | "PLANNING") {
  const { id } = await prisma.event.create({
    data: {
      name,
      purpose: "SCRUM-249 journey",
      description: "Owned by the SCRUM-249 e2e spec.",
      status,
      organiserId: "usr_organiser",
      coordinatorId: "usr_coordinator",
      startAt: new Date(Date.now() - DAY_MS),
      endAt: new Date(Date.now() - DAY_MS / 2),
      expectedAttendance: 30,
      submittedAt: new Date(Date.now() - 2 * DAY_MS),
    },
    select: { id: true },
  });
  ids.push(id);
}

test.describe("SCRUM-249 — an overdue event", () => {
  test.skip(!usesLocalDatabase, "writes events straight to the database");

  test.afterAll(async () => {
    await prisma.notification.deleteMany({ where: { eventId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.event.deleteMany({ where: { id: { in: ids } } });
  });

  test("SCRUM-249 [AC1, AC4] TC-249-10: Under Review, the Coordinator is told to close it, isn't offered Approve, and can reject it", async ({
    page,
  }) => {
    const name = `SCRUM-249 Review ${Date.now()}`;
    await overdueEvent(name, "UNDER_REVIEW");

    await signIn(page, "coordinator@test.local");
    const listRow = page.getByRole("row", { name: new RegExp(name) });
    await expect(listRow.getByTestId("overdue-badge")).toBeVisible();
    await expect(listRow.getByRole("button", { name: "Reject", exact: true })).toBeVisible();
    await expect(listRow.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);

    await openEvent(page, name);
    const step = page.getByTestId("next-step");
    await expect(step).toContainText(CLOSE_IT);
    await expect(step.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);

    await step.getByRole("button", { name: "Reject", exact: true }).click();
    await page.getByRole("radio").first().check();
    await page.getByLabel(/reason/i).fill("Its date has passed.");
    await page.getByRole("button", { name: /^Reject/ }).last().click();

    await expect(page.getByTestId("next-step")).toContainText("This request was rejected.");
  });

  test("SCRUM-249 [AC4] TC-249-11: in Planning, the banner leads to Reject event, and Cancel event is on the page", async ({
    page,
  }) => {
    const name = `SCRUM-249 Planning ${Date.now()}`;
    await overdueEvent(name, "PLANNING");

    await signIn(page, "coordinator@test.local");
    await openEvent(page, name);
    const step = page.getByTestId("next-step");
    await expect(step).toContainText(CLOSE_IT);
    await expect(page.getByRole("button", { name: /Cancel event/ })).toBeVisible();

    await step.getByRole("button", { name: "Go to Arrangements" }).click();
    await expect(page.getByRole("button", { name: "Reject event" })).toBeVisible();
  });

  test("SCRUM-249 [AC4] TC-249-12: the Organiser's banner still waits for the Coordinator", async ({
    page,
  }) => {
    const name = `SCRUM-249 Organiser ${Date.now()}`;
    await overdueEvent(name, "UNDER_REVIEW");

    await signIn(page, "organiser@test.local");
    await openEvent(page, name);

    await expect(page.getByTestId("next-step")).toContainText("to review the request");
    await expect(page.getByTestId("next-step")).not.toContainText("overdue");
  });
});
