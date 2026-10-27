import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { usesLocalDatabase, pickDateTime } from "./helpers";

/**
 * SCRUM-130 — an Organiser discards a Draft they no longer need. Each test
 * creates its own events straight in the database, so the journey owns its
 * data. Test cases: docs/testing/SCRUM-130.md.
 */

async function signInAsOrganiser(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("organiser@test.local");
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/events");
}

const DAY = 86_400_000;

test.describe("SCRUM-130 — Discard a draft request", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  let prefix: string;

  test.beforeEach(({}, testInfo) => {
    prefix = `SCRUM-130 e2e ${testInfo.workerIndex} ${Date.now()}`;
  });

  test.afterEach(async () => {
    const ids = (
      await prisma.event.findMany({
        where: { name: { startsWith: prefix } },
        select: { id: true },
      })
    ).map((e) => e.id);
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.event.deleteMany({ where: { id: { in: ids } } });
  });

  function draft(name: string, startAt: Date | null = null) {
    return prisma.event.create({
      data: {
        name,
        status: "DRAFT",
        organiserId: "usr_organiser",
        startAt,
        endAt: startAt && new Date(startAt.getTime() + 2 * 3_600_000),
      },
    });
  }

  test("SCRUM-130 [AC1, AC2] TC-130-01, TC-130-03: cancelling the prompt keeps the draft; confirming removes it for good", async ({
    page,
  }) => {
    const name = `${prefix} no longer needed`;
    const { id } = await draft(name);
    await signInAsOrganiser(page);

    const row = page.getByRole("row", { name: new RegExp(name) });
    const confirm = page.getByRole("dialog", { name: "Discard this draft?" });

    // AC2: Keep Draft closes the prompt and nothing changes.
    await row.getByRole("button", { name: "Discard" }).click();
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText(name);
    await confirm.getByRole("button", { name: "Keep Draft" }).click();
    await expect(confirm).toBeHidden();
    await page.reload();
    await expect(row).toBeVisible();
    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id } })).discardedAt,
    ).toBeNull();

    // AC2: closing the prompt with Escape is a cancel too.
    await row.getByRole("button", { name: "Discard" }).click();
    await page.keyboard.press("Escape");
    await expect(confirm).toBeHidden();
    await expect(row).toBeVisible();

    // AC1: confirmed, it leaves the list and stays gone after a reload.
    await row.getByRole("button", { name: "Discard" }).click();
    await confirm.getByRole("button", { name: "Discard Draft" }).click();
    await expect(page.getByText(`"${name}" was discarded.`)).toBeVisible();
    await expect(confirm).toBeHidden();
    await expect(row).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "My Events" }),
    ).toBeVisible();
    await expect(row).toHaveCount(0);
    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id } })).discardedAt,
    ).not.toBeNull();
  });

  test("SCRUM-130 [AC3] TC-130-04: Discard is offered on a Draft but not on a submitted request", async ({
    page,
  }) => {
    const draftName = `${prefix} draft`;
    const submittedName = `${prefix} submitted`;
    await draft(draftName);
    await prisma.event.create({
      data: {
        name: submittedName,
        status: "SUBMITTED",
        organiserId: "usr_organiser",
        submittedAt: new Date(),
      },
    });
    await signInAsOrganiser(page);

    const draftRow = page.getByRole("row", { name: new RegExp(draftName) });
    const submittedRow = page.getByRole("row", {
      name: new RegExp(submittedName),
    });
    await expect(
      draftRow.getByRole("button", { name: "Discard" }),
    ).toBeVisible();
    await expect(submittedRow).toBeVisible();
    await expect(
      submittedRow.getByRole("button", { name: "Discard" }),
    ).toHaveCount(0);
  });

  test("SCRUM-130 [AC6] TC-130-10, TC-130-11: a draft whose start has passed warns when opened, and the warning clears once the start is moved forward", async ({
    page,
  }) => {
    const pastName = `${prefix} past dates`;
    const futureName = `${prefix} future dates`;
    await draft(pastName, new Date(Date.now() - 7 * DAY));
    await draft(futureName, new Date(Date.now() + 30 * DAY));
    await signInAsOrganiser(page);

    const warning = page
      .getByRole("dialog")
      .getByRole("alert")
      .filter({
        hasText: "Dates are in the past – update them before submitting",
      });

    // A draft with future dates shows no warning.
    await page
      .getByRole("row", { name: new RegExp(futureName) })
      .getByRole("button", { name: /Resume Draft/i })
      .click();
    await expect(
      page.getByRole("heading", { name: /Resume Draft Event Request/i }),
    ).toBeVisible();
    await expect(warning).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // AC6: opening the past-dated draft shows the warning straight away.
    await page
      .getByRole("row", { name: new RegExp(pastName) })
      .getByRole("button", { name: /Resume Draft/i })
      .click();
    await expect(warning).toBeVisible();

    // Updating the event date to a future one clears it.
    await page.getByRole("button", { name: "Next", exact: true }).click();
    const nextYear = new Date().getUTCFullYear() + 1;
    await pickDateTime(page.getByLabel("Event Date *"), `${nextYear}-06-01`);
    await expect(warning).toHaveCount(0);
  });
});
