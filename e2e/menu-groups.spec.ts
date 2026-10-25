import { test, expect, type Page } from "@playwright/test";

import { signedIn } from "./helpers";

/**
 * SCRUM-210 — each role signs in to its own list, and its menu is grouped by
 * task. Reads only seeded accounts; writes nothing. Test cases:
 * docs/testing/SCRUM-210.md.
 */

type Expected = {
  email: string;
  landing: RegExp;
  /** Each group's heading (null for a single link) and its links, in order. */
  groups: [string | null, string[]][];
};

const MENUS: Record<string, Expected> = {
  Organiser: {
    email: "organiser@test.local",
    landing: /\/events$/,
    groups: [[null, ["My Events"]]],
  },
  Coordinator: {
    email: "coordinator@test.local",
    landing: /\/events$/,
    groups: [
      [null, ["Events"]],
      ["Venues", ["Venue Search", "Request Venue", "Availability", "Venue Catalogue"]],
      [null, ["Equipment Requests"]],
      [null, ["All Events"]],
    ],
  },
  "Event Coordinator Lead": {
    email: "lead@test.local",
    landing: /\/queue$/,
    groups: [
      [null, ["Unassigned Queue"]],
      [null, ["Venue Catalogue"]],
      [null, ["All Events"]],
    ],
  },
  "Venue Staff": {
    email: "venuestaff@test.local",
    landing: /\/bookings$/,
    groups: [
      [null, ["Bookings"]],
      ["Venues", ["Availability", "Venue Catalogue"]],
      [null, ["All Events"]],
    ],
  },
  "Technical Support": {
    email: "techsupport@test.local",
    landing: /\/equipment$/,
    groups: [
      ["My work", ["Equipment", "Equipment Requests"]],
      [null, ["Venue Catalogue"]],
      [null, ["All Events"]],
    ],
  },
  "Safety Officer": {
    email: "safety@test.local",
    landing: /\/safety-checks$/,
    groups: [
      [null, ["Safety Checks"]],
      [null, ["Venue Catalogue"]],
    ],
  },
  Attendee: {
    email: "attendee@test.local",
    landing: /\/events$/,
    groups: [["My work", ["Browse Events", "My Registrations"]]],
  },
  // SCRUM-121: Venue Staff first, then Technical Support, Coordinator and
  // Organiser; it lands where Venue Staff does.
  "Several roles": {
    email: "multirole@test.local",
    landing: /\/bookings$/,
    groups: [
      ["My work", ["Events", "Bookings", "Equipment", "Equipment Requests"]],
      ["Venues", ["Venue Search", "Request Venue", "Availability", "Venue Catalogue"]],
      [null, ["All Events"]],
    ],
  },
};

const menu = (page: Page) => page.getByRole("complementary", { name: "Primary" });

/** The links' names, in order: collapsed, a link is an icon named by its label. */
const names = (links: ReturnType<Page["getByRole"]>) =>
  links.evaluateAll((all) => all.map((link) => link.getAttribute("aria-label")));

async function expectMenu(page: Page, groups: Expected["groups"]) {
  const nav = menu(page);
  // Every link, once, in the menu's order.
  const all = groups.flatMap(([, links]) => links);
  await expect(nav.getByRole("link")).toHaveCount(all.length);
  expect(await names(nav.getByRole("link"))).toEqual(all);
  for (const [heading, links] of groups) {
    if (!heading) continue;
    expect(await names(nav.getByRole("group", { name: heading }).getByRole("link"))).toEqual(links);
  }
  // A group's heading is named once; single links have none.
  const headings = groups.flatMap(([heading]) => (heading ? [heading] : []));
  await expect(nav.getByRole("group")).toHaveCount(headings.length);
}

test.describe("SCRUM-210 — Menus grouped by task", () => {
  for (const [who, expected] of Object.entries(MENUS)) {
    test(`SCRUM-210 [AC1, AC3, AC4] TC-210-01, TC-210-06, TC-210-08: ${who} lands on its own list, with its menu grouped by task`, async ({
      browser,
    }) => {
      const page = await signedIn(browser, expected.email);

      await expect(page).toHaveURL(expected.landing);
      await expectMenu(page, expected.groups);
      await expect(menu(page).getByRole("link", { name: /Notifications/ })).toHaveCount(0);
    });
  }

  test("SCRUM-210 [AC1] TC-210-09: expanded, the rail shows each group's heading; collapsed, the same links show as icons", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "coordinator@test.local");
    const nav = menu(page);

    // Collapsed by default: icons, no heading text.
    await expect(nav.getByText("Venues", { exact: true })).toHaveCount(0);
    await nav.getByRole("button", { name: "Expand navigation" }).click();
    await expect(nav.getByText("Venues", { exact: true })).toBeVisible();
    await expectMenu(page, MENUS.Coordinator.groups);
  });

  test("SCRUM-210 [AC1] TC-210-09: on a phone (SCRUM-132) the bar keeps every link, in the same order, without headings", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("coordinator@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/events$/);

    const nav = menu(page);
    for (const link of await nav.getByRole("link").all()) await expect(link).toBeVisible();
    expect(await names(nav.getByRole("link"))).toEqual(
      MENUS.Coordinator.groups.flatMap(([, links]) => links),
    );
    await expect(nav.getByText("Venues", { exact: true })).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
    await context.close();
  });
});
