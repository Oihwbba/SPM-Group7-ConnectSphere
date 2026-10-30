import { test, expect } from "@playwright/test";

import { signedIn, optionsOf } from "./helpers";

/**
 * SCRUM-233 — no event stays Approved, since approval saves Planning (SCRUM-81
 * AC1), so neither events list offers it as a filter. Read-only against the
 * seed.
 */
test.describe("SCRUM-233 — the status filters follow the event lifecycle", () => {
  test("SCRUM-233 [AC3] TC-233-03: My Events and All Events don't offer Approved, and still offer Planning", async ({
    browser,
  }) => {
    const organiser = await signedIn(browser, "organiser@test.local");
    await organiser.goto("/events");
    // optionsOf reads a dropdown that isn't shown as offering nothing, so wait
    // for it: All Events shows its loading screen until the list arrives.
    const mineFilter = organiser.getByRole("combobox", { name: "Filter by status" });
    await expect(mineFilter).toBeVisible();
    const mine = (await optionsOf(mineFilter)).map((option) => option.label);
    expect(mine).toContain("Planning");
    expect(mine).not.toContain("Approved");

    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto("/all-events");
    const allFilter = coordinator.getByRole("combobox", { name: "Status" });
    await expect(allFilter).toBeVisible();
    const all = (await optionsOf(allFilter)).map((option) => option.label);
    expect(all).toContain("Planning");
    expect(all).not.toContain("Approved");
  });
});
