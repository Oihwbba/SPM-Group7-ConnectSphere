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
    const mine = (
      await optionsOf(organiser.getByRole("combobox", { name: "Filter by status" }))
    ).map((option) => option.label);
    expect(mine).toContain("Planning");
    expect(mine).not.toContain("Approved");

    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto("/all-events");
    const all = (
      await optionsOf(coordinator.getByRole("combobox", { name: "Status" }))
    ).map((option) => option.label);
    expect(all).toContain("Planning");
    expect(all).not.toContain("Approved");
  });
});
