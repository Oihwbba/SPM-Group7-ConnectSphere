import { test, expect } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-48 — a user reads their notification list. Each journey uses its own
 * throwaway account, with its own event and notifications, so its unread
 * count can't move when another spec notifies a seeded user, and a retry
 * starts from the same state. Everything is removed afterwards.
 */
const STAMP = Date.now();
const ORGANISER = `usr_ntf_org_${STAMP}`;
const EMPTY_USER = `usr_ntf_empty_${STAMP}`;
const EVENT_NAME = `SCRUM-48 Gala ${STAMP}`;

async function account(
  id: string,
  role: "ORGANISER" | "ATTENDEE",
  name: string,
) {
  await prisma.user.upsert({
    where: { id },
    update: {},
    create: {
      id,
      email: `${id}@test.local`,
      name,
      role,
      passwordHash: await bcrypt.hash("Password123!", 10),
    },
  });
}

test.describe("SCRUM-48 — User views their notification list", () => {
  test.skip(!usesLocalDatabase, "writes notifications; local database only");

  test.afterAll(async () => {
    const users = [ORGANISER, EMPTY_USER];
    await prisma.notification.deleteMany({ where: { userId: { in: users } } });
    await prisma.event.deleteMany({ where: { organiserId: ORGANISER } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  });

  test("SCRUM-48 [AC1, AC2, AC3, AC5] TC-48-02, TC-48-04, TC-48-07: opening the newest notification marks it read, lowers the count and opens the event", async ({
    browser,
  }) => {
    await account(ORGANISER, "ORGANISER", "Nell Notified");
    // A retry starts again from one unread notice on one event.
    await prisma.notification.deleteMany({ where: { userId: ORGANISER } });
    await prisma.event.deleteMany({ where: { organiserId: ORGANISER } });
    const { id: eventId } = await prisma.event.create({
      data: {
        name: EVENT_NAME,
        status: "UNDER_REVIEW",
        organiserId: ORGANISER,
        submittedAt: new Date(),
      },
      select: { id: true },
    });
    const { id: noticeId } = await prisma.notification.create({
      data: {
        userId: ORGANISER,
        type: "EVENT_STATUS_CHANGED",
        title: "Your event was updated",
        message: `"${EVENT_NAME}" was updated.`,
        eventId,
      },
      select: { id: true },
    });
    // AC8: written for later, so not shown or counted yet.
    await prisma.notification.create({
      data: {
        userId: ORGANISER,
        type: "HOLD_EXPIRY_REMINDER",
        title: "Not yet",
        message: "Shown in an hour.",
        showFromAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const page = await signedIn(browser, `${ORGANISER}@test.local`);
    const bell = page.getByRole("link", { name: /^Notifications, / });
    await expect(bell).toHaveAccessibleName("Notifications, 1 unread");

    await bell.click();
    await expect(
      page.getByRole("heading", { name: "Notifications" }),
    ).toBeVisible();
    const items = page.getByTestId("notification");
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText("Your event was updated");
    await expect(items.first()).toHaveAttribute("data-read", "false");
    await expect(page.getByText("Not yet")).toHaveCount(0);

    await items.first().click();

    // SCRUM-208: the notice opens the event's own page.
    await page.waitForURL(new RegExp(`/events/${eventId}$`));
    await expect(
      page.getByRole("heading", { level: 1, name: EVENT_NAME }),
    ).toBeVisible();
    await expect(bell).toHaveAccessibleName("Notifications, none unread");
    expect(
      (
        await prisma.notification.findUniqueOrThrow({
          where: { id: noticeId },
          select: { readAt: true },
        })
      ).readAt,
    ).not.toBeNull();

    await page.goto("/notifications");
    await expect(page.getByTestId("notification").first()).toHaveAttribute(
      "data-read",
      "true",
    );
  });

  test("SCRUM-48 [AC5, AC6] TC-48-09: a link to another Organiser's event, or to one that doesn't exist, opens nothing", async ({
    browser,
  }) => {
    await account(ORGANISER, "ORGANISER", "Nell Notified");
    const page = await signedIn(browser, `${ORGANISER}@test.local`);

    // The seeded "Under Review — Career Fair" belongs to organiser@test.local.
    for (const id of ["evt_under_review", "evt_does_not_exist"]) {
      // An old link goes to the event's page, which is "not found" for both
      // (SCRUM-68, SCRUM-208 AC5).
      const response = await page.goto(`/events?event=${id}`);
      expect(response?.status()).toBe(404);
      await expect(page.getByText("Under Review — Career Fair")).toHaveCount(0);
    }
  });

  test("SCRUM-48 [AC4] TC-48-05: a user with no notifications sees an empty state, not an error", async ({
    browser,
  }) => {
    await account(EMPTY_USER, "ATTENDEE", "Nora Nothing");

    const page = await signedIn(browser, `${EMPTY_USER}@test.local`);
    await page.goto("/notifications");

    await expect(page.getByText("No notifications yet")).toBeVisible();
    await expect(page.getByTestId("notification")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Notifications, none unread" }),
    ).toBeVisible();
  });
});
