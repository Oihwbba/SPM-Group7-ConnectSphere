import { test, expect } from "@playwright/test";

import { signedIn } from "./helpers";

/**
 * SCRUM-131 — every screen uses the agreed status names. Read-only: it uses
 * the seeded organiser's events and writes nothing.
 */
test.describe("SCRUM-131 agreed status names", () => {
  test("SCRUM-131 [AC1] TC-131-01: the Organiser's tab of every request that isn't a draft reads Sent, and the status filter offers the nine agreed names", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "organiser@test.local");
    await page.goto("/events");

    await expect(page.getByRole("button", { name: /^Sent \(\d+\)$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Submitted \(/ })).toHaveCount(0);

    await expect(
      page.getByRole("combobox", { name: "Filter by status" }).locator("option"),
    ).toHaveText([
      "All Statuses",
      "Draft",
      "Submitted",
      "Under Review",
      "Approved",
      "Planning",
      "Confirmed",
      "Completed",
      "Cancelled",
      "Rejected",
    ]);
  });
});
