import { test, expect, type Page } from "@playwright/test";

/**
 * The top bar every signed-in page shares (app/(app)/layout.tsx). SCRUM-168
 * took out its placeholder search box; SCRUM-48 put the notification bell
 * beside the profile menu. One page per role covers every page, since they
 * all render the same layout. It only signs in and looks, so it runs on any
 * database.
 */
const PHONE = { width: 375, height: 812 };

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  // Sign-in lands on "/", which sends each role on to its own page; measure
  // that page once it has rendered, not the hop in between.
  await page.waitForURL(
    (url) => url.pathname !== "/" && !url.pathname.startsWith("/login"),
  );
  await expect(page.getByRole("main")).not.toBeEmpty();
}

test.describe("Top bar — SCRUM-168", () => {
  test.use({ viewport: PHONE });

  for (const email of [
    "organiser@test.local",
    "coordinator@test.local",
    "venuestaff@test.local",
    "techsupport@test.local",
    "attendee@test.local",
  ]) {
    test(`SCRUM-168 [AC1, AC3] TC-168-01, TC-168-03: at phone width, ${email} sees no search box, the brand on the left, and the bell and profile menu together on the right`, async ({
      page,
    }) => {
      await signIn(page, email);
      const header = page.getByRole("banner");
      const brand = header.getByText("ConnectSphere", { exact: true });
      const bell = header.getByRole("link", { name: /^Notifications,/ });
      const menu = header.getByRole("button", { name: "Open user menu" });
      await expect(brand).toBeVisible();
      await expect(bell).toBeVisible();
      await expect(menu).toBeVisible();

      // AC1: nothing to type into.
      await expect(header.getByRole("searchbox")).toHaveCount(0);
      await expect(header.getByRole("textbox")).toHaveCount(0);

      // AC3: one row, brand at the left edge, bell and menu side by side at
      // the right edge, with no gap where the search box was.
      const [bar, b, n, m] = await Promise.all(
        [header, brand, bell, menu].map(async (l) => (await l.boundingBox())!),
      );
      for (const box of [b, n, m]) {
        expect(box.y).toBeGreaterThanOrEqual(bar.y);
        expect(box.y + box.height).toBeLessThanOrEqual(bar.y + bar.height);
      }
      expect(b.x).toBeLessThan(PHONE.width / 4);
      expect(b.x + b.width).toBeLessThan(n.x);
      expect(m.x - (n.x + n.width)).toBeLessThanOrEqual(8);
      expect(m.x + m.width).toBeGreaterThan(PHONE.width - 32);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(PHONE.width);
    });
  }
});
