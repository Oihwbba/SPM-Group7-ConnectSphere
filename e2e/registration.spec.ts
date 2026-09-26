import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

/**
 * SCRUM-73/74 — an Attendee registers for an event. Writes real rows (a
 * throwaway Confirmed event plus its registration), so — like the other
 * writing specs in this suite — it only runs against a localhost database.
 */
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

test.describe("SCRUM-73/74 — Attendee registers for an event", () => {
  test.skip(!usesLocalDatabase, "writes its own event; local database only");

  let eventId: string;
  let eventName: string;

  test.beforeEach(async () => {
    eventName = `SCRUM-73 Registration Test ${Date.now()}`;
    const event = await prisma.event.create({
      data: {
        name: eventName,
        purpose: "Registration journey",
        description: "Owned by the SCRUM-73 e2e spec.",
        status: "CONFIRMED",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        startAt: new Date("2031-09-01T02:00:00Z"),
        endAt: new Date("2031-09-01T10:00:00Z"),
        expectedAttendance: 2,
        registrationEnabled: true,
      },
      select: { id: true },
    });
    eventId = event.id;
  });

  test.afterEach(async () => {
    await prisma.registration.deleteMany({ where: { eventId } });
    await prisma.notification.deleteMany({ where: { eventId } });
    await prisma.auditLog.deleteMany({ where: { entityId: eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
  });

  test("AC: registering shows as registered immediately, and capacity decreases by one", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("attendee@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/events");

    const card = page.getByTestId("browsable-event-card").filter({
      hasText: eventName,
    });
    await expect(card).toBeVisible();
    await expect(card.getByTestId("remaining-capacity")).toHaveText(
      "2 of 2 places remaining",
    );

    await card.click();
    await expect(page.getByRole("heading", { name: eventName })).toBeVisible();
    await expect(page.getByTestId("remaining-capacity")).toHaveText(
      "2 of 2 places remaining",
    );

    await page.getByTestId("register-button").click();
    await expect(
      page.getByText("You're registered for this event."),
    ).toBeVisible();

    // AC: "immediately visible to the Attendee with a status of registered."
    await expect(page.getByTestId("already-registered")).toBeVisible();
    await expect(page.getByTestId("remaining-capacity")).toHaveText(
      "1 of 2 places remaining",
    );

    // Back on the list, the same event now shows "you're registered" too.
    await page.goto("/events");
    const registeredCard = page.getByTestId("browsable-event-card").filter({
      hasText: eventName,
    });
    await expect(
      registeredCard.getByTestId("already-registered"),
    ).toBeVisible();
    await expect(registeredCard.getByTestId("remaining-capacity")).toHaveText(
      "1 of 2 places remaining",
    );
  });

  test("AC: a full event refuses direct registration and shows no register action", async ({
    page,
  }) => {
    // Fill both places with two other attendees before this test's own user
    // (attendee@test.local) tries the event, so it is genuinely full.
    await prisma.registration.createMany({
      data: [
        { eventId, userId: "usr_attendee_2", status: "REGISTERED" },
        { eventId, userId: "usr_attendee_3", status: "REGISTERED" },
      ],
    });

    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("attendee@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/events");

    const card = page.getByTestId("browsable-event-card").filter({
      hasText: eventName,
    });
    await expect(card.getByTestId("registration-state-badge")).toHaveText(
      "Full",
    );
    await card.click();

    await expect(page.getByTestId("register-button")).toBeDisabled();
    await expect(
      page.getByText(
        "This event is full. You can check back in case a place opens up.",
      ),
    ).toBeVisible();
  });
});

test.describe("SCRUM-74/77 — Attendee withdraws from an event", () => {
  test.skip(!usesLocalDatabase, "writes its own event; local database only");

  let eventId: string;
  let eventName: string;

  test.beforeEach(async () => {
    eventName = `SCRUM-74 Withdrawal Test ${Date.now()}`;
    const event = await prisma.event.create({
      data: {
        name: eventName,
        purpose: "Withdrawal journey",
        description: "Owned by the SCRUM-74 e2e spec.",
        status: "CONFIRMED",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        startAt: new Date("2031-09-02T02:00:00Z"),
        endAt: new Date("2031-09-02T10:00:00Z"),
        expectedAttendance: 1,
        registrationEnabled: true,
      },
      select: { id: true },
    });
    eventId = event.id;
    // attendee@test.local registers up front — this spec only exercises
    // withdrawing an existing registration, not the register step itself
    // (already covered by the SCRUM-73 describe block above).
    await prisma.registration.create({
      data: { eventId, userId: "usr_attendee", status: "REGISTERED" },
    });
  });

  test.afterEach(async () => {
    await prisma.registration.deleteMany({ where: { eventId } });
    await prisma.notification.deleteMany({ where: { eventId } });
    await prisma.auditLog.deleteMany({ where: { entityId: eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
  });

  test("AC: withdrawing reopens capacity immediately and lets another attendee register", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("attendee@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/events");

    const card = page.getByTestId("browsable-event-card").filter({
      hasText: eventName,
    });
    await expect(card.getByTestId("registration-state-badge")).toHaveText(
      "Full",
    );
    await card.click();

    await expect(page.getByRole("heading", { name: eventName })).toBeVisible();
    await expect(page.getByTestId("already-registered")).toBeVisible();
    await expect(page.getByTestId("remaining-capacity")).toHaveText(
      "0 of 1 places remaining",
    );

    await page.getByTestId("withdraw-button").click();
    await expect(
      page.getByText("You've withdrawn from this event."),
    ).toBeVisible();

    await expect(page.getByTestId("already-registered")).not.toBeVisible();
    await expect(page.getByTestId("remaining-capacity")).toHaveText(
      "1 of 1 places remaining",
    );
    await expect(page.getByTestId("register-button")).toBeEnabled();

    // A second attendee can now take the place the withdrawal freed.
    await page.context().clearCookies();
    await page.goto("/login");
    await page
      .getByLabel("Email", { exact: true })
      .fill("attendee4@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/events");

    await page
      .getByTestId("browsable-event-card")
      .filter({ hasText: eventName })
      .click();
    await page.getByTestId("register-button").click();
    await expect(
      page.getByText("You're registered for this event."),
    ).toBeVisible();
    await expect(page.getByTestId("remaining-capacity")).toHaveText(
      "0 of 1 places remaining",
    );
  });
});
