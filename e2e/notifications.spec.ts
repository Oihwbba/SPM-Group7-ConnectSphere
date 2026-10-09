import { test, expect } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-48 — a user reads their notification list. The Organiser journey adds
 * its own notifications on the seeded "Under Review — Career Fair" and
 * removes them afterwards; the empty state uses a throwaway account, so it
 * doesn't depend on which seeded users other specs notify.
 */
const TITLE = `SCRUM-48 e2e ${Date.now()}`;
const EMPTY_USER = `usr_ntf_empty_${Date.now()}`;

test.describe("SCRUM-48 — User views their notification list", () => {
  test.skip(!usesLocalDatabase, "writes notifications; local database only");

  test.afterAll(async () => {
    await prisma.notification.deleteMany({
      where: { title: { startsWith: TITLE } },
    });
    await prisma.user.deleteMany({ where: { id: EMPTY_USER } });
  });

  test("SCRUM-48 [AC1, AC2, AC3, AC5] TC-48-02, TC-48-04, TC-48-07: opening the newest notification marks it read, lowers the count and opens the event", async ({
    browser,
  }) => {
    await prisma.notification.create({
      data: {
        userId: "usr_organiser",
        type: "EVENT_STATUS_CHANGED",
        title: TITLE,
        message: "Your event was updated.",
        eventId: "evt_under_review",
      },
    });
    // AC8: written for later, so not shown or counted yet.
    await prisma.notification.create({
      data: {
        userId: "usr_organiser",
        type: "HOLD_EXPIRY_REMINDER",
        title: `${TITLE} later`,
        message: "Not yet.",
        showFromAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const unread = await prisma.notification.count({
      where: {
        userId: "usr_organiser",
        readAt: null,
        withdrawnAt: null,
        showFromAt: { lte: new Date() },
      },
    });

    const page = await signedIn(browser, "organiser@test.local");
    const bell = page.getByRole("link", { name: /^Notifications, / });
    await expect(bell).toHaveAccessibleName(`Notifications, ${unread} unread`);

    await bell.click();
    await expect(
      page.getByRole("heading", { name: "Notifications" }),
    ).toBeVisible();
    const items = page.getByTestId("notification");
    await expect(items.first()).toContainText(TITLE);
    await expect(items.first()).toHaveAttribute("data-read", "false");
    await expect(page.getByText(`${TITLE} later`)).toHaveCount(0);

    await items.first().click();

    await page.waitForURL(/\/events\?event=evt_under_review$/);
    await expect(
      page.getByRole("dialog").getByRole("heading", {
        name: "Under Review — Career Fair",
      }),
    ).toBeVisible();
    // An open dialog hides the header from assistive technology; closing it
    // also drops ?event=, so a refresh doesn't open it again.
    await page.keyboard.press("Escape");
    await page.waitForURL(/\/events$/);
    await expect(bell).toHaveAccessibleName(
      unread - 1 === 0
        ? "Notifications, none unread"
        : `Notifications, ${unread - 1} unread`,
    );
    const opened = await prisma.notification.findFirstOrThrow({
      where: { title: TITLE },
      select: { readAt: true },
    });
    expect(opened.readAt).not.toBeNull();

    await page.goto("/notifications");
    await expect(
      page.getByTestId("notification").filter({ hasText: TITLE }).first(),
    ).toHaveAttribute("data-read", "true");
  });

  test("SCRUM-48 [AC4] TC-48-05: a user with no notifications sees an empty state, not an error", async ({
    browser,
  }) => {
    await prisma.user.create({
      data: {
        id: EMPTY_USER,
        email: `${EMPTY_USER}@test.local`,
        name: "Nora Nothing",
        role: "ATTENDEE",
        passwordHash: await bcrypt.hash("Password123!", 10),
      },
    });

    const page = await signedIn(browser, `${EMPTY_USER}@test.local`);
    await page.goto("/notifications");

    await expect(page.getByText("No notifications yet")).toBeVisible();
    await expect(page.getByTestId("notification")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Notifications, none unread" }),
    ).toBeVisible();
  });
});
