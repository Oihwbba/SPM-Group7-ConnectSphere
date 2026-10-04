import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

// Writes its own events, so it runs only against a local database (CI's).
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

async function signInAs(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/events");
}

function row(page: Page, name: string) {
  return page.getByRole("row", { name: new RegExp(name) });
}

/**
 * SCRUM-69 — a Coordinator's default list holds the events assigned to them
 * plus unassigned Submitted ones. Handover (SCRUM-21) isn't built yet, so AC3
 * changes the assignment directly, as the story's change log says to.
 */
test.describe("SCRUM-69 — View only the events assigned to me", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  const stamp = Date.now();
  const mine = `SCRUM-69 Cody's Event ${stamp}`;
  const theirs = `SCRUM-69 Cara's Event ${stamp}`;
  const unassigned = `SCRUM-69 Unassigned Event ${stamp}`;
  const ids: string[] = [];

  test.beforeEach(async () => {
    const base = {
      purpose: "SCRUM-69 e2e",
      description: "Owned by the SCRUM-69 e2e spec.",
      organiserId: "usr_organiser",
      startAt: new Date("2031-10-02T02:00:00Z"),
      endAt: new Date("2031-10-02T10:00:00Z"),
      expectedAttendance: 50,
    };
    for (const data of [
      {
        ...base,
        name: mine,
        status: "UNDER_REVIEW" as const,
        coordinatorId: "usr_coordinator",
      },
      {
        ...base,
        name: theirs,
        status: "UNDER_REVIEW" as const,
        coordinatorId: "usr_coordinator_2",
      },
      { ...base, name: unassigned, status: "SUBMITTED" as const },
    ]) {
      const { id } = await prisma.event.create({ data, select: { id: true } });
      ids.push(id);
    }
  });

  test.afterEach(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.event.deleteMany({ where: { id: { in: ids } } });
    ids.length = 0;
  });

  test("AC1, AC4: my default list shows my events and unassigned Submitted ones, not another Coordinator's", async ({
    page,
  }) => {
    await signInAs(page, "coordinator@test.local");

    await expect(row(page, mine)).toBeVisible();
    await expect(row(page, unassigned)).toBeVisible();
    await expect(row(page, theirs)).toHaveCount(0);
  });

  test("AC2: the list shows each event's name, proposed date and status, and can be searched", async ({
    page,
  }) => {
    await signInAs(page, "coordinator@test.local");

    const myRow = row(page, mine);
    await expect(myRow.getByTestId("status-badge")).toHaveAttribute(
      "data-status",
      "UNDER_REVIEW",
    );
    await expect(myRow).toContainText("SGT");

    await page.getByLabel("Search by name or purpose").fill(mine);
    await expect(row(page, mine)).toBeVisible();
    await expect(row(page, unassigned)).toHaveCount(0);
  });

  test("AC3: an event handed to another Coordinator leaves my list and appears in theirs", async ({
    page,
  }) => {
    await prisma.event.update({
      where: { id: ids[0] },
      data: { coordinatorId: "usr_coordinator_2" },
    });

    await signInAs(page, "coordinator@test.local");
    await expect(row(page, unassigned)).toBeVisible();
    await expect(row(page, mine)).toHaveCount(0);

    await signInAs(page, "coordinator2@test.local");
    await expect(row(page, mine)).toBeVisible();
  });

  test("AC4: an unassigned Submitted event appears in every Coordinator's list", async ({
    page,
  }) => {
    await signInAs(page, "coordinator2@test.local");

    await expect(row(page, unassigned)).toBeVisible();
    await expect(row(page, theirs)).toBeVisible();
    await expect(row(page, mine)).toHaveCount(0);
  });
});
