import { test, expect, type Locator, type Page } from "@playwright/test";
import type { Role } from "@prisma/client";

import { NAV_BY_ROLE } from "@/lib/nav";
import { signedIn } from "./helpers";

// SCRUM-207 — every page fits a phone: nothing scrolls sideways, what you tap
// is big enough to hit, the confirmation pop-up fits, and a text field doesn't
// make an iPhone zoom. Read-only: nothing here changes any data.

const PHONE = { width: 360, height: 740 };
const SMALL_PHONE = { width: 320, height: 640 };

const ACCOUNTS: [Role, string][] = [
  ["ORGANISER", "organiser@test.local"],
  ["COORDINATOR", "coordinator@test.local"],
  ["VENUE_STAFF", "venuestaff@test.local"],
  ["TECH_SUPPORT", "techsupport@test.local"],
  ["ATTENDEE", "attendee@test.local"],
  ["COORDINATOR_LEAD", "lead@test.local"],
  ["SAFETY_OFFICER", "safety@test.local"],
];

// A page off the menu for each role: the pages that hold tables, cards and
// decisions.
const DETAIL_PAGES: Partial<Record<Role, string[]>> = {
  ORGANISER: ["/events/evt_planning", "/notifications"],
  COORDINATOR: ["/events/evt_planning?tab=arrangements", "/all-events/evt_planning"],
  VENUE_STAFF: ["/bookings?status=all&open=bkg_pending", "/venues/ven_auditorium"],
  TECH_SUPPORT: ["/equipment-requests?status=all&open=eqr_in_review"],
  ATTENDEE: ["/events/evt_confirmed"],
  COORDINATOR_LEAD: ["/queue?status=all"],
  SAFETY_OFFICER: ["/safety-checks?status=all&open=sfc_awaiting"],
};

/** What runs past the screen's right edge: the page itself, or a box in it. */
async function sidewaysScroll(page: Page) {
  return page.evaluate(() => {
    const found: string[] = [];
    const root = document.documentElement;
    if (root.scrollWidth > window.innerWidth) {
      found.push(`the page is ${root.scrollWidth}px wide`);
    }
    for (const el of document.body.querySelectorAll<HTMLElement>("*")) {
      // A row of tabs scrolls sideways on a phone by design (SCRUM-208
      // TC-208-14); the page around it doesn't.
      if (el.getAttribute("role") === "tablist") continue;
      const { overflowX } = getComputedStyle(el);
      if (
        (overflowX === "auto" || overflowX === "scroll") &&
        el.clientWidth > 0 &&
        el.scrollWidth > el.clientWidth + 1
      ) {
        found.push(
          `${el.tagName.toLowerCase()} "${el.innerText.slice(0, 30)}" is ${el.scrollWidth}px in ${el.clientWidth}px`,
        );
      }
    }
    return found;
  });
}

async function height(target: Locator) {
  const box = await target.boundingBox();
  expect(box, "on screen").not.toBeNull();
  return box!.height;
}

test.describe("SCRUM-207 every page fits a phone", () => {
  for (const [role, email] of ACCOUNTS) {
    test(`SCRUM-207 [AC1] TC-207-26: ${role}'s pages scroll only up and down at phone width`, async ({
      browser,
    }) => {
      const page = await signedIn(browser, email);
      const pages = [
        ...NAV_BY_ROLE[role].map((item) => item.href),
        ...(DETAIL_PAGES[role] ?? []),
      ];
      for (const size of [PHONE, SMALL_PHONE]) {
        await page.setViewportSize(size);
        for (const path of pages) {
          await page.goto(path);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          expect(await sidewaysScroll(page), `${path} at ${size.width}px`).toEqual([]);
        }
      }
    });
  }

  test("SCRUM-207 [AC1] TC-207-27: a queue's rows show every column with its name, and what you tap is at least 44px tall, at phone width", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "venuestaff@test.local");
    await page.setViewportSize(PHONE);
    await page.goto("/bookings?status=all");
    const row = page.getByTestId("queue-row").first();
    for (const testId of ["event-date", "asked", "requested"]) {
      const cell = row.getByTestId(testId);
      await expect(cell).toBeVisible();
      const box = await cell.boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(PHONE.width);
    }
    // The sort links stay usable on a phone.
    for (const name of [/^Event date/, /^Requested/]) {
      expect(await height(page.getByRole("link", { name }))).toBeGreaterThanOrEqual(44);
    }

    await page.goto("/venues/ven_auditorium");
    expect(await height(page.getByTestId("back-link"))).toBeGreaterThanOrEqual(44);
    await page.goto("/venues");
    expect(
      await height(page.getByRole("link", { name: "View Grand Auditorium" })),
    ).toBeGreaterThanOrEqual(44);

    // The event page's tabs, which scroll sideways in their own row on a
    // phone (SCRUM-208), are tall enough to tap.
    const organiser = await signedIn(browser, "organiser@test.local");
    await organiser.setViewportSize(PHONE);
    await organiser.goto("/events/evt_planning");
    for (const tab of await organiser.getByRole("tab").all()) {
      expect(await height(tab)).toBeGreaterThanOrEqual(44);
    }
  });

  test("SCRUM-207 [AC5] TC-207-28: the confirmation pop-up fits a small phone, with both its buttons in view and big enough to tap", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "venuestaff@test.local");
    await page.setViewportSize(SMALL_PHONE);
    await page.goto("/bookings?status=all&open=bkg_pending");
    await page.getByRole("button", { name: "Reject" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // The pop-up zooms in as it opens, so it is measured once it has settled.
    await expect(async () => {
      const box = await dialog.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(SMALL_PHONE.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(SMALL_PHONE.height);
    }).toPass();
    for (const testId of ["confirm-dialog-confirm", "confirm-dialog-cancel"]) {
      await expect(dialog.getByTestId(testId)).toBeInViewport();
      expect(await height(dialog.getByTestId(testId))).toBeGreaterThanOrEqual(44);
    }
    // Read-only: leave without rejecting.
    await dialog.getByTestId("confirm-dialog-cancel").click();
    await expect(dialog).toBeHidden();
  });

  test("SCRUM-207 [AC4] TC-207-29: a form's text fields use 16px type, and its checkboxes and close button are big enough to tap, at phone width", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "venuestaff@test.local");
    await page.setViewportSize(PHONE);
    await page.goto("/venues");
    await page.getByRole("button", { name: "Add venue" }).click();
    const form = page.getByRole("dialog");
    const sizes = await form
      .locator("input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea")
      .evaluateAll((fields) =>
        fields
          .filter((field) => (field as HTMLElement).offsetParent !== null)
          .map((field) => parseFloat(getComputedStyle(field).fontSize)),
      );
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.every((size) => size >= 16), `font sizes ${sizes}`).toBe(true);
    // Sizes are read once the pop-up has finished zooming in.
    await expect(async () => {
      const closed = form.getByRole("checkbox", { name: "Monday closed" });
      const box = await closed.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(20);
      expect(box!.height).toBeGreaterThanOrEqual(20);
      // A pop-up's close button is big enough to tap too.
      expect(
        await height(
          form.getByRole("button", { name: "Close", exact: true }),
        ),
      ).toBeGreaterThanOrEqual(44);
    }).toPass();
    await page.keyboard.press("Escape");
  });
});
