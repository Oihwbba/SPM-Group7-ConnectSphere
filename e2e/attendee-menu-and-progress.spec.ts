import { test, expect, type Browser, type Page } from "@playwright/test";

/**
 * SCRUM-248 — an Attendee's menu has no "My work" heading, on the rail and on
 * the phone's bar; and at 360 px (SCRUM-132 AC1) every step of the event
 * progress is readable, with no line crossing a label. Reads only seeded
 * accounts and events; writes nothing.
 */
const PHONE = { width: 360, height: 740 };

async function signedInAt(
  browser: Browser,
  email: string,
  viewport?: typeof PHONE,
): Promise<Page> {
  const context = await browser.newContext(viewport ? { viewport } : {});
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  return page;
}

const menu = (page: Page) =>
  page.getByRole("complementary", { name: "Primary" });

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

test.describe("SCRUM-248 — an Attendee's menu, and the event progress on a phone", () => {
  for (const [where, viewport] of [
    ["on the rail", undefined],
    ["on the phone's bar", PHONE],
  ] as const) {
    test(`SCRUM-248 [AC1] TC-248-01: ${where}, an Attendee sees Browse Events and My Registrations as their own links, with no My work`, async ({
      browser,
    }) => {
      const page = await signedInAt(browser, "attendee@test.local", viewport);
      await expect(page).toHaveURL(/\/events$/);
      const nav = menu(page);

      for (const name of ["Browse Events", "My Registrations"]) {
        await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
      }
      await expect(nav.getByRole("button", { name: "My work" })).toHaveCount(0);
      await expect(nav.getByRole("group")).toHaveCount(0);
      await expect(
        nav.getByRole("link", { name: "Browse Events", exact: true }),
      ).toHaveAttribute("aria-current", "page");

      await nav.getByRole("link", { name: "My Registrations", exact: true }).click();
      await expect(page).toHaveURL(/\/registrations$/);
      await page.context().close();
    });
  }

  test("SCRUM-248 [AC2] TC-248-03: at 360 px every progress step is readable and no line crosses a label, at every status", async ({
    browser,
  }) => {
    const page = await signedInAt(browser, "organiser@test.local", PHONE);
    for (const [eventId, status, current] of [
      ["evt_clarification_fields", "UNDER_REVIEW", "Review"],
      ["evt_rejected", "REJECTED", "Rejected"],
      ["evt_replanning", "PLANNING", "Planning"],
      ["evt_cancellation_requested", "CONFIRMED", "Confirmed"],
      ["evt_completed", "COMPLETED", null],
      ["evt_cancelled", "CANCELLED", "Cancelled"],
    ] as const) {
      await page.goto(`/events/${eventId}`);
      const progress = page.getByTestId("status-badge");
      await expect(progress).toHaveAttribute("data-status", status);
      const steps = progress.getByRole("list", { name: "Progress" });
      const labels = steps.getByTestId("progress-label");
      await expect(labels).toHaveCount(5);
      if (current) {
        await expect(
          steps.locator('[aria-current="step"]').getByTestId("progress-label"),
        ).toHaveText(current);
      }

      const list = (await steps.boundingBox())!;
      const labelBoxes = await Promise.all(
        (await labels.all()).map(async (label) => {
          await expect(label).toBeVisible();
          return (await label.boundingBox())!;
        }),
      );
      const lineBoxes = await Promise.all(
        (await steps.getByTestId("progress-line").all()).map(
          async (line) => (await line.boundingBox())!,
        ),
      );
      expect(lineBoxes).toHaveLength(4);

      for (const [i, box] of labelBoxes.entries()) {
        // Whole, inside the list: nothing cut off or scrolled away.
        expect(box.x, `${status} label ${i}`).toBeGreaterThanOrEqual(list.x);
        expect(box.x + box.width, `${status} label ${i}`).toBeLessThanOrEqual(
          list.x + list.width,
        );
        for (const other of labelBoxes.slice(i + 1)) {
          expect(overlaps(box, other), `${status}: labels run together`).toBe(false);
        }
        for (const line of lineBoxes) {
          expect(overlaps(box, line), `${status}: a line crosses label ${i}`).toBe(false);
        }
      }
      expect(
        await steps.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
    }
    await page.context().close();
  });
});
