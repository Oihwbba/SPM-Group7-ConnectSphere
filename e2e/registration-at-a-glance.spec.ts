import { test, expect, type Locator, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-212 — an Attendee sees at a glance whether they can register (AC1)
 * and what their registration says (AC2), on a phone too (AC3). Test cases
 * and the agreed state mapping: docs/testing/SCRUM-212.md.
 *
 * Fixtures (prisma/seed.ts): attendee4 holds no registrations, so the seeded
 * events show their own state to them; attendee holds places at the Charity
 * Gala, the Wine Tasting (full) and the Studio Masterclass.
 */

const PHONE = { width: 360, height: 740 };
/** The smallest comfortable tap target, in CSS pixels. */
const TAP = 44;

const card = (page: Page, name: string) =>
  page.getByTestId("browsable-event-card").filter({ hasText: name });

const row = (page: Page, name: string) =>
  page.getByTestId("registration-card").filter({ hasText: name });

async function expectState(
  scope: Locator | Page,
  badge: string,
  line: string | RegExp,
) {
  await expect(scope.getByTestId("registration-state-badge")).toHaveText(badge);
  await expect(scope.getByTestId("registration-state-line")).toHaveText(line);
}

async function height(locator: Locator) {
  return (await locator.boundingBox())?.height ?? 0;
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe("SCRUM-212 [AC1] each event shows one clear registration state", () => {
  const states: { name: string; badge: string; line: string | RegExp }[] = [
    {
      name: "Confirmed: Registration Open — Charity Gala",
      badge: "Open",
      line: "118 places left",
    },
    {
      name: "Confirmed: One Place Left — Studio Masterclass",
      badge: "Open",
      line: "1 place left",
    },
    {
      name: "Confirmed: Registration Full — Wine Tasting Evening",
      badge: "Full",
      line: "No places left",
    },
    {
      name: "Confirmed: Registration Not Open — Summer Camp",
      badge: "Not open yet",
      line: /^Opens \d{1,2} \w{3,4} \d{4}, \d{1,2}:\d{2}\s[ap]m SGT$/,
    },
    {
      name: "Confirmed: Registration Closed — Leadership Retreat",
      badge: "Closed",
      line: "Registration is closed",
    },
  ];

  test("SCRUM-212 [AC1] TC-212-06: Browse Events shows open with places left, full, not open yet and closed, and the event page says the same", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "attendee4@test.local");
    await page.goto("/events");

    for (const { name, badge, line } of states) {
      await expectState(card(page, name), badge, line);
    }

    for (const { name, badge, line } of states) {
      await page.goto("/events");
      await card(page, name).click();
      await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
      await expectState(page, badge, line);
    }
  });

  test("SCRUM-212 [AC1] TC-212-07: my own registration comes first, as You're registered, even for a full event, with Withdraw on the event page", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "attendee@test.local");
    await page.goto("/events");

    for (const name of [
      "Confirmed: Registration Open — Charity Gala",
      "Confirmed: Registration Full — Wine Tasting Evening",
    ]) {
      await expectState(
        card(page, name),
        "You're registered",
        "You can withdraw until the event starts.",
      );
    }
    // Not registered here, so the event's own state shows.
    await expectState(
      card(page, "Confirmed: Registration Closed — Leadership Retreat"),
      "Closed",
      "Registration is closed",
    );

    await card(page, "Confirmed: Registration Full — Wine Tasting Evening").click();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Confirmed: Registration Full — Wine Tasting Evening",
      }),
    ).toBeVisible();
    await expectState(
      page,
      "You're registered",
      "You can withdraw until the event starts.",
    );
    await expect(page.getByTestId("withdraw-button")).toBeVisible();
    await expect(page.getByTestId("register-button")).toHaveCount(0);
  });
});

test.describe("SCRUM-212 [AC2] My Registrations", () => {
  test("SCRUM-212 [AC2] TC-212-08: each row shows the event, its date and time, its venue, my status and a link to the event", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "attendee@test.local");
    await page.goto("/registrations");

    const gala = row(page, "Confirmed: Registration Open — Charity Gala");
    await expect(
      gala.getByRole("heading", { name: "Confirmed: Registration Open — Charity Gala" }),
    ).toBeVisible();
    await expect(gala.getByTestId("event-date")).toHaveText(
      /^\d{1,2} \w{3,4} \d{4}, \d{1,2}:\d{2}\s[ap]m SGT – \d{1,2}:\d{2}\s[ap]m SGT$/,
    );
    await expect(gala.getByTestId("venue")).not.toBeEmpty();
    await expect(gala.getByTestId("registration-status")).toHaveText(
      "Registered",
    );
    await expect(gala.getByTestId("withdraw-button")).toBeVisible();

    // A cancelled event: its status, no Withdraw, and no page to go to.
    const cancelled = row(page, "Cancelled: After Confirmation — Winter Workshop");
    await expect(cancelled.getByTestId("registration-status")).toHaveText(
      "Cancelled",
    );
    await expect(cancelled.getByTestId("withdraw-button")).toHaveCount(0);
    await expect(
      cancelled.getByRole("link", { name: "View event" }),
    ).toHaveCount(0);

    await gala.getByRole("link", { name: "View event" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Confirmed: Registration Open — Charity Gala" }),
    ).toBeVisible();
  });

  test("SCRUM-212 [AC2] TC-212-11: an Attendee with no registrations is told so, with a link to Browse Events", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "attendee4@test.local");
    await page.goto("/registrations");

    const empty = page.getByTestId("registrations-empty");
    await expect(empty).toContainText(
      "You haven't registered for any events yet",
    );
    await expect(page.getByTestId("registration-card")).toHaveCount(0);
    await empty.getByRole("link", { name: "Browse Events" }).click();
    await page.waitForURL("**/events");
    await expect(
      page.getByTestId("browsable-event-card").first(),
    ).toBeVisible();
  });
});

test.describe("SCRUM-212 [AC2] withdrawing through the shared dialog", () => {
  test.skip(!usesLocalDatabase, "writes its own event; local database only");

  let eventId = "";
  let eventName = "";

  // Amir (attendee2), so the specs that count attendee's registrations exactly
  // are untouched.
  test.beforeEach(async () => {
    eventName = `SCRUM-212 Withdraw ${Date.now()}`;
    const startAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const event = await prisma.event.create({
      data: {
        name: eventName,
        purpose: "Withdrawal through the shared dialog",
        description: "Owned by the SCRUM-212 e2e spec.",
        status: "CONFIRMED",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        startAt,
        endAt: new Date(startAt.getTime() + 2 * 60 * 60 * 1000),
        expectedAttendance: 5,
        registrationEnabled: true,
      },
      select: { id: true },
    });
    eventId = event.id;
    await prisma.registration.create({
      data: { eventId, userId: "usr_attendee_2", status: "REGISTERED" },
    });
  });

  test.afterEach(async () => {
    // An undefined filter matches every row, so never clean up without an id.
    if (!eventId) return;
    await prisma.registration.deleteMany({ where: { eventId } });
    await prisma.notification.deleteMany({ where: { eventId } });
    await prisma.auditLog.deleteMany({ where: { entityId: eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
    eventId = "";
  });

  const status = async () =>
    (await prisma.registration.findFirstOrThrow({ where: { eventId } })).status;

  test("SCRUM-212 [AC2] TC-212-09, SCRUM-207 [AC5] TC-207-10: on My Registrations, Keep my place changes nothing, and Withdraw withdraws", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "attendee2@test.local");
    await page.goto("/registrations");
    const mine = row(page, eventName);
    await expect(mine.getByTestId("registration-status")).toHaveText(
      "Registered",
    );
    // No approved booking yet.
    await expect(mine.getByTestId("venue")).toHaveText("Venue to be confirmed");

    await mine.getByTestId("withdraw-button").click();
    const dialog = page.getByTestId("withdraw-dialog");
    await expect(
      dialog.getByRole("heading", { name: "Withdraw from this event?" }),
    ).toBeVisible();
    await expect(dialog).toContainText(eventName);
    await dialog.getByRole("button", { name: "Keep my place" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(mine.getByTestId("registration-status")).toHaveText(
      "Registered",
    );
    expect(await status()).toBe("REGISTERED");

    await mine.getByTestId("withdraw-button").click();
    await dialog.getByRole("button", { name: "Withdraw", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(mine.getByTestId("registration-status")).toHaveText(
      "Withdrawn",
    );
    await expect(mine.getByTestId("withdraw-button")).toHaveCount(0);
    expect(await status()).toBe("WITHDRAWN");
  });

  test("SCRUM-212 [AC1, AC2] TC-212-09, SCRUM-207 [AC5] TC-207-10: on the event page, withdrawing turns You're registered back into Open with the place given back", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "attendee2@test.local");
    await page.goto(`/events/${eventId}`);
    await expectState(
      page,
      "You're registered",
      "You can withdraw until the event starts.",
    );

    await page.getByTestId("withdraw-button").click();
    await page
      .getByTestId("withdraw-dialog")
      .getByRole("button", { name: "Withdraw", exact: true })
      .click();

    await expectState(page, "Open", "5 places left");
    await expect(page.getByTestId("register-button")).toBeEnabled();
    expect(await status()).toBe("WITHDRAWN");
  });
});

test.describe("SCRUM-212 [AC3] the pages work on a phone", () => {
  test("SCRUM-212 [AC3] TC-212-12: at 360 px, Browse Events, the event page and My Registrations don't scroll sideways, show the state without opening anything, and have easy-to-tap buttons", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "attendee@test.local");
    await page.setViewportSize(PHONE);

    await page.goto("/events");
    const gala = card(page, "Confirmed: Registration Open — Charity Gala");
    await expect(gala.getByTestId("registration-state-badge")).toBeInViewport();
    await expect(gala.getByTestId("registration-state-line")).toBeInViewport();
    await page.waitForLoadState("networkidle");
    expect(await overflow(page)).toBeLessThanOrEqual(0);

    await gala.click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Confirmed: Registration Open — Charity Gala" }),
    ).toBeVisible();
    await expect(page.getByTestId("registration-state-badge")).toBeInViewport();
    await expect(page.getByTestId("registration-state-line")).toBeInViewport();
    expect(
      await height(page.getByTestId("withdraw-button")),
    ).toBeGreaterThanOrEqual(TAP);
    expect(await overflow(page)).toBeLessThanOrEqual(0);

    // The dialog fits the phone, and its buttons are easy to tap. Keep my
    // place: nothing is written.
    await page.getByTestId("withdraw-button").click();
    const dialog = page.getByTestId("withdraw-dialog");
    const keep = dialog.getByRole("button", { name: "Keep my place" });
    const withdraw = dialog.getByRole("button", {
      name: "Withdraw",
      exact: true,
    });
    await expect(keep).toBeInViewport();
    await expect(withdraw).toBeInViewport();
    // Polled: the dialog zooms in from 95% as it opens.
    await expect.poll(() => height(keep)).toBeGreaterThanOrEqual(TAP);
    await expect.poll(() => height(withdraw)).toBeGreaterThanOrEqual(TAP);
    await expect
      .poll(async () => (await dialog.boundingBox())?.width ?? Infinity)
      .toBeLessThanOrEqual(PHONE.width);
    await keep.click();
    await expect(dialog).toHaveCount(0);

    await page.goto("/registrations");
    const mine = row(page, "Confirmed: Registration Open — Charity Gala");
    await expect(mine.getByTestId("registration-status")).toBeVisible();
    expect(
      await height(mine.getByRole("link", { name: "View event" })),
    ).toBeGreaterThanOrEqual(TAP);
    expect(
      await height(mine.getByTestId("withdraw-button")),
    ).toBeGreaterThanOrEqual(TAP);
    await page.waitForLoadState("networkidle");
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
});
