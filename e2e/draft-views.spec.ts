import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

import { usesLocalDatabase } from "./helpers";

/**
 * SCRUM-16 AC8 — showing, filtering and resuming a draft change nothing: the
 * status changes only through the actions SCRUM-24 lists. Test cases:
 * docs/testing/SCRUM-16.md.
 */
test.describe("SCRUM-16 — looking at a draft changes nothing", () => {
  test.skip(!usesLocalDatabase, "writes its own event; local database only");

  test("SCRUM-16 [AC8] TC-16-05: switching tabs, opening a draft and closing Resume Draft leave it a Draft with no new history", async ({
    page,
  }) => {
    const name = `SCRUM-16 e2e ${Date.now()}`;
    const { id, updatedAt } = await prisma.event.create({
      data: { name, status: "DRAFT", organiserId: "usr_organiser" },
      select: { id: true, updatedAt: true },
    });
    try {
      await page.goto("/login");
      await page.getByLabel("Email", { exact: true }).fill("organiser@test.local");
      await page.getByLabel("Password", { exact: true }).fill("Password123!");
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL("**/events");

      for (const tab of [/^Drafts \(/, /^Sent \(/, /^All \(/]) {
        await page.getByRole("button", { name: tab }).click();
      }
      const row = page.getByRole("row", { name: new RegExp(name) });
      // SCRUM-208: the draft opens on its own page; reading it changes nothing.
      await row.getByRole("link", { name: "View Details" }).click();
      await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
      await page.getByRole("link", { name: "Back to My Events" }).click();

      await row.getByRole("button", { name: "Resume Draft" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
      await page.reload();
      await expect(row).toBeVisible();

      expect(
        await prisma.event.findUniqueOrThrow({ where: { id }, select: { status: true, updatedAt: true } }),
      ).toEqual({ status: "DRAFT", updatedAt });
      expect(await prisma.auditLog.count({ where: { entityId: id } })).toBe(0);
    } finally {
      await prisma.auditLog.deleteMany({ where: { entityId: id } });
      await prisma.event.delete({ where: { id } });
    }
  });
});
