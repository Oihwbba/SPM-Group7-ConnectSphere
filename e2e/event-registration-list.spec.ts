import { test, expect, type Page } from "@playwright/test";

/**
 * SCRUM-70 — the Organiser and the assigned Coordinator see an event's
 * registrations. Read-only against the seeded Charity Gala (evt_confirmed):
 * owned by organiser@, assigned to coordinator@, 120 places, Aria and Amir
 * Registered, Ana Withdrawn.
 */
async function openGala(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/events");

  await page
    .getByRole("row", { name: /Confirmed — Charity Gala/ })
    .getByTestId("view-details-button")
    .click();
  return page.getByRole("dialog").getByTestId("registration-list");
}

test.describe("SCRUM-70 — an event's registration list", () => {
  for (const { email, who } of [
    { email: "organiser@test.local", who: "AC2: the Organiser" },
    { email: "coordinator@test.local", who: "AC1: the assigned Coordinator" },
  ]) {
    test(`${who} sees the registered count, remaining places and each Attendee's status (AC3, AC4)`, async ({
      page,
    }) => {
      const list = await openGala(page, email);

      await expect(list.getByTestId("registration-summary")).toHaveText(
        "2 registered · 118 of 120 places remaining",
      );
      const registered = list
        .getByTestId("registration-row")
        .and(list.locator('[data-status="REGISTERED"]'));
      await expect(registered).toHaveCount(2);
      await expect(registered.filter({ hasText: "Aria Attendee" })).toHaveCount(
        1,
      );

      // AC4: Withdrawn is listed apart and isn't in the count above.
      const inactive = list.getByTestId("inactive-registrations");
      await expect(inactive).toContainText("Ana Attendee");
      await expect(inactive).toContainText("Withdrawn");
    });
  }
});
