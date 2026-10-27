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
 * SCRUM-69 — a Coordinator's default list holds the events assigned to them.
 * SCRUM-165 replaced AC1/AC4's "plus unassigned Submitted ones": those now
 * wait in the Lead's queue (e2e/lead-queue.spec.ts). Handover (SCRUM-21) isn't built yet, so AC3
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
    // Approving notifies the seeded Organiser; their list is shared by other specs.
    await prisma.notification.deleteMany({ where: { eventId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.event.deleteMany({ where: { id: { in: ids } } });
    ids.length = 0;
  });

  test("SCRUM-69 [AC1, AC4] TC-69-01, TC-69-02, SCRUM-165 [AC8] TC-165-11: my default list shows my events, not another Coordinator's and not unassigned requests (they wait for the Lead)", async ({
    page,
  }) => {
    await signInAs(page, "coordinator@test.local");

    await expect(row(page, mine)).toBeVisible();
    await expect(row(page, theirs)).toHaveCount(0);
    await expect(row(page, unassigned)).toHaveCount(0);
  });

  test("SCRUM-69 [AC2] TC-69-03, SCRUM-168 [AC2] TC-168-02: the list shows each event's name, proposed date and status, and can be searched", async ({
    page,
  }) => {
    await signInAs(page, "coordinator@test.local");

    const myRow = row(page, mine);
    await expect(myRow.getByTestId("status-badge")).toHaveAttribute(
      "data-status",
      "UNDER_REVIEW",
    );
    await expect(myRow).toContainText("SGT");

    await page
      .getByLabel("Search by name or purpose")
      .fill("no event is called this");
    await expect(row(page, mine)).toHaveCount(0);
    await page.getByLabel("Search by name or purpose").fill(mine);
    await expect(row(page, mine)).toBeVisible();
  });

  test("SCRUM-69 [AC3] TC-69-04: an event handed to another Coordinator leaves my list and appears in theirs", async ({
    page,
  }) => {
    await prisma.event.update({
      where: { id: ids[0] },
      data: { coordinatorId: "usr_coordinator_2" },
    });

    await signInAs(page, "coordinator2@test.local");
    await expect(row(page, mine)).toBeVisible();
    await expect(row(page, theirs)).toBeVisible();

    await signInAs(page, "coordinator@test.local");
    await expect(row(page, mine)).toHaveCount(0);
  });

  test("SCRUM-69 [AC1, AC4] TC-69-01, TC-69-05, SCRUM-135 [AC3, AC4, AC11] TC-135-03, SCRUM-165 [AC4, AC8] TC-165-11: an unassigned Submitted event is in no Coordinator's list", async ({
    page,
  }) => {
    for (const email of ["coordinator@test.local", "coordinator2@test.local"]) {
      await signInAs(page, email);
      // The list has loaded: each sees their own event first.
      await expect(
        row(page, email.startsWith("coordinator2") ? theirs : mine),
      ).toBeVisible();
      await expect(row(page, unassigned)).toHaveCount(0);
    }
  });

  test("SCRUM-135 [AC3, AC4, AC11] TC-135-03: my Under Review event can be approved, and moves to Planning", async ({
    page,
  }) => {
    await signInAs(page, "coordinator@test.local");
    const myRow = row(page, mine);
    await myRow.getByRole("button", { name: "Approve" }).click();
    // SCRUM-81: approval moves the event straight to Planning.
    await expect(myRow.getByTestId("status-badge")).toHaveAttribute(
      "data-status",
      "PLANNING",
    );
  });
});
