import { test, expect, type Page } from "@playwright/test";

/**
 * SCRUM-76 — an Attendee sees the events they registered for and the status
 * of each. Read-only against seeded fixtures (prisma/seed.ts):
 *   attendee3 — Withdrawn from evt_confirmed, Registered for evt_full
 *   attendee  — reg_cancelled_1 on evt_cancelled → Cancelled
 *   attendee4 — no registrations → the empty state
 * attendee3 is used for the exact list because no other spec writes to it.
 * attendee4 is only registered by registration.spec.ts on an event it
 * deletes again, and CI runs e2e on one worker, so it is empty here.
 */
async function signInAs(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/events");
}

function card(page: Page, eventName: string) {
  return page.getByTestId("registration-card").filter({ hasText: eventName });
}

test.describe("SCRUM-76 — Attendee views their registration status", () => {
  test("AC1, AC2: my list shows each event's name, date, venue and status", async ({
    page,
  }) => {
    await signInAs(page, "attendee3@test.local");
    await page.goto("/registrations");

    await expect(
      page.getByRole("heading", { name: "My Registrations" }),
    ).toBeVisible();

    const full = card(page, "Full — Wine Tasting Evening");
    await expect(full.getByTestId("registration-status")).toHaveText(
      "Registered",
    );
    await expect(full.getByTestId("venue")).toContainText(
      "Executive Boardroom",
    );
    await expect(full.getByTestId("event-date")).toContainText("SGT");

    await expect(
      card(page, "Confirmed — Charity Gala").getByTestId("registration-status"),
    ).toHaveText("Withdrawn");
  });

  test("AC5: the list contains only my registrations", async ({ page }) => {
    await signInAs(page, "attendee3@test.local");
    await page.goto("/registrations");

    await expect(page.getByTestId("registration-card")).toHaveCount(2);
    // attendee and attendee2 hold places here; attendee3 does not.
    await expect(card(page, "One Place Left — Studio Masterclass")).toHaveCount(
      0,
    );
  });

  test("AC3: a registration for an event ConnectSphere cancelled shows as Cancelled", async ({
    page,
  }) => {
    await signInAs(page, "attendee@test.local");
    await page.goto("/registrations");

    await expect(
      card(page, "Cancelled — Winter Workshop").getByTestId(
        "registration-status",
      ),
    ).toHaveText("Cancelled");
  });

  test("an Attendee with no registrations sees the empty state with a link to browse events", async ({
    page,
  }) => {
    await signInAs(page, "attendee4@test.local");
    await page.goto("/registrations");

    await expect(page.getByText("No registrations yet")).toBeVisible();
    await expect(page.getByTestId("registration-card")).toHaveCount(0);
    // exact: the sidebar also has a "Browse Events" link.
    await page
      .getByRole("link", { name: "Browse events", exact: true })
      .click();
    await page.waitForURL("**/events");
  });

  test("an Organiser typing /registrations directly is refused", async ({
    page,
  }) => {
    await signInAs(page, "organiser@test.local");
    await page.goto("/registrations");

    await expect(
      page.getByRole("heading", { name: "Access denied" }),
    ).toBeVisible();
  });
});
