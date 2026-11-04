import { test, expect } from "@playwright/test";

import { signedIn, optionsOf } from "./helpers";

/**
 * SCRUM-131 — every screen uses the agreed status names. Read-only: it uses
 * the seeded organiser's events and writes nothing.
 */
test.describe("SCRUM-131 agreed status names", () => {
  test("SCRUM-131 [AC1] TC-131-01: the Organiser's list filters by the agreed names an event can rest in, and groups none of them under another name", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "organiser@test.local");
    await page.goto("/events");

    // AC1, as the PO settled it on 2 Nov 2026: the tabs that grouped several
    // statuses under one name are gone, so "Submitted" can only be the status.
    await expect(page.getByRole("button", { name: /^Sent \(/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Submitted \(/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^All \(/ })).toHaveCount(0);

    const offered = await optionsOf(
      page.getByRole("combobox", { name: "Filter by status" }),
    );
    expect(offered.map((option) => option.label)).toEqual([
      "All Statuses",
      "Draft",
      "Submitted",
      "Under Review",
      // SCRUM-233: no event stays Approved (SCRUM-81 AC1), so it isn't offered.
      "Planning",
      "Confirmed",
      "Completed",
      "Cancelled",
      "Rejected",
    ]);
  });
});
