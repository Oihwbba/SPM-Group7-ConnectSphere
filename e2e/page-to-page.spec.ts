import { test, expect, type Page } from "@playwright/test";

import { signedIn } from "./helpers";

// SCRUM-207 — moving between pages from the menu keeps the current page on
// screen until the next one is ready, so nothing flashes in between. A loading
// skeleton shown for the third of a second a page takes to render read as a
// grey flash on every click.

/** Counts every loading placeholder put on the page from now on. */
async function watchForPlaceholders(page: Page) {
  await page.evaluate(() => {
    const seen = window as unknown as { placeholders: number };
    seen.placeholders = 0;
    const placeholder = '[aria-busy="true"], .animate-pulse';
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element && (node.matches(placeholder) || node.querySelector(placeholder))) {
            seen.placeholders++;
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
}

const placeholdersShown = (page: Page) =>
  page.evaluate(() => (window as unknown as { placeholders: number }).placeholders);

test.describe("SCRUM-207 — moving between pages", () => {
  test("SCRUM-207 TC-207-25: a menu click keeps the current page until the next is ready, with no loading placeholder in between", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "coordinator@test.local");
    await page.goto("/events");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await watchForPlaceholders(page);

    for (const [link, path] of [
      ["Equipment Requests", "/equipment-requests"],
      ["All Events", "/all-events"],
      ["Events", "/events"],
    ] as const) {
      await page.getByRole("link", { name: link, exact: true }).first().click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    // A link inside a menu group (SCRUM-210).
    await page.getByRole("button", { name: "Venues" }).first().click();
    await page.getByRole("link", { name: "Availability", exact: true }).first().click();
    await expect(page).toHaveURL(/\/venues\/availability/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    expect(await placeholdersShown(page)).toBe(0);
  });
});
