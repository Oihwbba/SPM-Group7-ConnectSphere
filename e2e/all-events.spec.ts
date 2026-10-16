import { test, expect, type Page } from "@playwright/test";

/**
 * SCRUM-141 — every event, read-only, for planning. Read-only against the
 * seed: "Submitted — Alumni Homecoming" is unassigned, "Confirmed — Charity
 * Gala" is Cody's with Exhibition Hall booked, and "Draft — Annual Tech
 * Summit" is a draft.
 */
async function signInAs(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

function row(page: Page, name: string) {
  return page.getByTestId("all-events-row").filter({ hasText: name });
}

test.describe("SCRUM-141 — See every event read-only for planning", () => {
  test("SCRUM-141 [AC1, AC2] TC-141-01, TC-141-02: a Coordinator sees every event except drafts, with its date, status, venues and Coordinator", async ({
    page,
  }) => {
    await signInAs(page, "coordinator@test.local");
    await page.getByRole("link", { name: "All Events" }).click();
    await page.waitForURL("**/all-events");

    const gala = row(page, "Confirmed — Charity Gala");
    await expect(gala.getByTestId("venues")).toContainText("Exhibition Hall");
    await expect(gala.getByTestId("coordinator")).toHaveText(
      "Cody Coordinator",
    );
    await expect(gala).toContainText("SGT");
    await expect(
      row(page, "Submitted — Alumni Homecoming").getByTestId("coordinator"),
    ).toHaveText("Unassigned");
    await expect(row(page, "Draft — Annual Tech Summit")).toHaveCount(0);
  });

  test("SCRUM-141 [AC2, AC7] TC-141-02, TC-141-10: filtering by status narrows the list, and no match says so", async ({
    page,
  }) => {
    await signInAs(page, "venuestaff@test.local");
    await page.goto("/all-events?status=CANCELLED");

    await expect(row(page, "Cancelled — Winter Workshop")).toBeVisible();
    await expect(row(page, "Confirmed — Charity Gala")).toHaveCount(0);

    await page.goto("/all-events?status=COMPLETED&from=2099-01-01");
    await expect(page.getByText("No events match")).toBeVisible();
    await expect(page.getByTestId("all-events-row")).toHaveCount(0);
  });

  test("SCRUM-141 [AC3] TC-141-05: a Coordinator opens an event that isn't theirs read-only", async ({
    page,
  }) => {
    await signInAs(page, "coordinator2@test.local");
    await page.goto("/all-events");
    await row(page, "Confirmed — Charity Gala").getByRole("link").click();

    await expect(
      page.getByRole("heading", { name: "Confirmed — Charity Gala" }),
    ).toBeVisible();
    await expect(page.getByTestId("read-only")).toContainText(
      "only the event's assigned Coordinator can change it",
    );
    await expect(page.getByTestId("event-details")).toContainText(
      "Exhibition Hall",
    );
    await expect(
      page.getByRole("link", { name: "Open in my Events" }),
    ).toHaveCount(0);
  });

  test("SCRUM-141 [AC2, AC3, AC5] TC-141-04, TC-141-06, TC-141-08: the Lead sees each Coordinator's active events, filters by Coordinator or Unassigned, and can assign from the list", async ({
    page,
  }) => {
    await signInAs(page, "lead@test.local");
    await page.getByRole("link", { name: "All Events" }).click();

    const cody = page
      .getByTestId("coordinator-load")
      .filter({ hasText: "Cody Coordinator" });
    await expect(cody).toContainText("active");
    await cody.click();
    await expect(row(page, "Confirmed — Charity Gala")).toBeVisible();
    await expect(row(page, "Submitted — Alumni Homecoming")).toHaveCount(0);

    await page.goto("/all-events?unassigned=1");
    await expect(row(page, "Submitted — Alumni Homecoming")).toBeVisible();
    await expect(row(page, "Confirmed — Charity Gala")).toHaveCount(0);

    await row(page, "Submitted — Alumni Homecoming").getByRole("link").click();
    await page.getByTestId("assign-link").click();
    await page.waitForURL("**/queue/**");
  });

  for (const email of [
    "organiser@test.local",
    "attendee@test.local",
    "safety@test.local",
  ]) {
    test(`SCRUM-141 [AC6] TC-141-09: ${email} typing /all-events directly is refused`, async ({
      page,
    }) => {
      await signInAs(page, email);
      await page.goto("/all-events");

      await expect(
        page.getByRole("heading", { name: "Access denied" }),
      ).toBeVisible();
    });
  }
});
