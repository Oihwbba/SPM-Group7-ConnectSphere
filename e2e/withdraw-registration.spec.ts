import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

// Writes its own events, so it runs only against a local database (CI's).
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/events");
}

/**
 * SCRUM-77 — an Attendee withdraws. attendee2 (Amir) is used because the
 * SCRUM-70 and SCRUM-76 specs count other attendees' registrations exactly.
 */
test.describe("SCRUM-77 — Withdraw my registration", () => {
  test.skip(!usesLocalDatabase, "writes its own events; local database only");

  let eventId = "";
  let eventName: string;

  async function createEventWithAmir(startAt: Date) {
    eventName = `SCRUM-77 Withdraw Test ${Date.now()}`;
    const event = await prisma.event.create({
      data: {
        name: eventName,
        purpose: "Withdrawal journey",
        description: "Owned by the SCRUM-77 e2e spec.",
        status: "CONFIRMED",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        startAt,
        endAt: new Date(startAt.getTime() + 4 * 60 * 60 * 1000),
        expectedAttendance: 5,
        registrationEnabled: true,
      },
      select: { id: true },
    });
    eventId = event.id;
    await prisma.registration.create({
      data: { eventId, userId: "usr_attendee_2", status: "REGISTERED" },
    });
  }

  test.afterEach(async () => {
    // An undefined filter matches every row, so never clean up without an id.
    if (!eventId) return;
    await prisma.registration.deleteMany({ where: { eventId } });
    await prisma.notification.deleteMany({ where: { eventId } });
    await prisma.auditLog.deleteMany({ where: { entityId: eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
    eventId = "";
  });

  test("SCRUM-77 [AC1, AC4, AC7] TC-77-01, TC-77-06, TC-77-09: a withdrawal shows at once to me and in the Organiser's and Coordinator's registration views", async ({
    page,
  }) => {
    await createEventWithAmir(new Date("2031-09-02T02:00:00Z"));

    await signIn(page, "attendee2@test.local");
    await page.goto(`/events/${eventId}`);
    await page.getByTestId("withdraw-button").click();
    await expect(
      page.getByText("You've withdrawn from this event."),
    ).toBeVisible();
    await expect(page.getByTestId("remaining-capacity")).toHaveText(
      "5 of 5 places remaining",
    );

    await signIn(page, "organiser@test.local");
    await page
      .getByRole("row", { name: new RegExp(eventName) })
      .getByTestId("view-details-button")
      .click();
    const list = page.getByRole("dialog").getByTestId("registration-list");
    await expect(list.getByTestId("registration-summary")).toHaveText(
      "0 registered · 5 of 5 places remaining",
    );
    await expect(list.getByTestId("inactive-registrations")).toContainText(
      "Amir Attendee",
    );

    // ...and in the assigned Coordinator's.
    await signIn(page, "coordinator@test.local");
    await page
      .getByRole("row", { name: new RegExp(eventName) })
      .getByTestId("view-details-button")
      .click();
    const coordinatorList = page
      .getByRole("dialog")
      .getByTestId("registration-list");
    await expect(
      coordinatorList.getByTestId("registration-summary"),
    ).toHaveText("0 registered · 5 of 5 places remaining");
    await expect(
      coordinatorList.getByTestId("inactive-registrations"),
    ).toContainText("Amir Attendee");
  });

  test("SCRUM-77 [AC3] TC-77-05: once the event has started, Withdraw isn't offered", async ({
    page,
  }) => {
    await createEventWithAmir(new Date(Date.now() - 60 * 60 * 1000));

    await signIn(page, "attendee2@test.local");
    await page.goto(`/events/${eventId}`);

    await expect(page.getByTestId("withdraw-closed")).toBeVisible();
    await expect(page.getByTestId("withdraw-button")).toHaveCount(0);
  });
});
