import { test, expect, type Page } from "@playwright/test";

import { openMenuGroup, signedIn } from "./helpers";

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

/**
 * The menu as the original design, grouped: one item per single link or per
 * group, in order; each group opened shows its own links, once.
 */
async function expectMenu(page: Page, groups: Expected["groups"]) {
  const nav = menu(page);
  // The top level: single links, and a button for each group of several.
  const top = nav.locator("nav > a, nav > div > button");
  expect(await top.evaluateAll((all) => all.map((item) => item.getAttribute("aria-label")))).toEqual(
    groups.map(([heading, links]) => heading ?? links[0]),
  );
  for (const [heading, links] of groups) {
    if (!heading) continue;
    await openMenuGroup(page, heading);
    const groupLinks = nav.getByRole("group", { name: heading }).getByRole("link");
    await expect(groupLinks).toHaveCount(links.length);
    expect(await names(groupLinks)).toEqual(links);
  }
  // With every group open, each link shows once.
  const all = groups.flatMap(([, links]) => links);
  await expect(nav.getByRole("link")).toHaveCount(all.length);
  expect(await names(nav.getByRole("link"))).toEqual(all);
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

  test("SCRUM-210 [AC1] TC-210-09: a group opens to show its links beneath it, indented, and the group of the page being viewed starts open", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "coordinator@test.local");
    const nav = menu(page);
    const venues = nav.getByRole("button", { name: "Venues", exact: true });

    // On Events, Venues starts closed: its links aren't shown.
    await expect(venues).toHaveAttribute("aria-expanded", "false");
    await expect(nav.getByRole("link", { name: "Venue Search" })).toHaveCount(0);

    // Expanded, the group reads "Venues" and opens beneath itself, indented.
    await nav.getByRole("button", { name: "Expand navigation" }).click();
    await expect(venues).toContainText("Venues");
    await venues.click();
    const search = nav.getByRole("link", { name: "Venue Search" });
    await expect(search).toBeVisible();
    const indent = (await search.boundingBox())!.x - (await venues.boundingBox())!.x;
    expect(indent).toBeGreaterThan(8);
    await venues.click();
    await expect(search).toHaveCount(0);

    // On one of its pages, the group starts open, with that page current.
    await page.goto("/venues/availability");
    await expect(venues).toHaveAttribute("aria-expanded", "true");
    await expect(nav.getByRole("link", { name: "Availability" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("SCRUM-210 [AC1] TC-210-09: on a phone (SCRUM-132) a group opens its links in a panel above the bar", async ({
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
    // The bar: Events, Venues, Equipment Requests, All Events.
    for (const name of ["Events", "Equipment Requests", "All Events"]) {
      await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await nav.getByRole("button", { name: "Venues", exact: true }).click();
    const panel = nav.getByRole("group", { name: "Venues" });
    expect(await names(panel.getByRole("link"))).toEqual(MENUS.Coordinator.groups[1][1]);
    for (const link of await panel.getByRole("link").all()) await expect(link).toBeVisible();
    await panel.getByRole("link", { name: "Venue Search" }).click();
    await expect(page).toHaveURL(/\/venues\/search/);
    await expect(panel).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
    await context.close();
  });
});
