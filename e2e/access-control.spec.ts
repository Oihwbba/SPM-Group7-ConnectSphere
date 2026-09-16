import { test, expect, type Page } from "@playwright/test";

/**
 * SCRUM-66 / SCRUM-67 / SCRUM-68 — access control at the route level.
 *
 * The happy path (a role reaches its own landing page) is covered by
 * events.spec.ts and equipment.spec.ts. This file pins the *negative* space:
 *
 *  - SCRUM-67: typing another role's URL directly is refused server-side, even
 *    though the UI never offered the link.
 *  - SCRUM-68: asking for another organiser's event by its identifier is
 *    indistinguishable from asking for one that never existed.
 *  - SCRUM-66: each role's navigation shows only that role's links.
 *  - SCRUM-67: a signed-out request to a protected URL bounces to /login.
 *
 * Passwords come from the seed (prisma/seed.ts) — every account shares
 * "Password123!".
 */

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  // Every role lands somewhere off /login (the exact route depends on the role).
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

// SCRUM-67 — "The refusal is returned even when the request bypasses the user
// interface entirely." An Organiser is never shown these links, but typing the
// URL must still be refused with the server-rendered Forbidden page.
test.describe("SCRUM-67 — typing another role's URL directly is refused", () => {
  const restricted = [
    { label: "Coordinator-only venues page", url: "/venues" },
    { label: "Venue-Staff bookings page", url: "/bookings" },
    { label: "Tech-Support equipment page", url: "/equipment" },
  ];

  for (const { label, url } of restricted) {
    test(`organiser is refused the ${label} (${url})`, async ({ page }) => {
      await signIn(page, "organiser@test.local");

      await page.goto(url);

      // The server chose not to render the real page — this is a genuine
      // server-side refusal, not a hidden link.
      await expect(
        page.getByRole("heading", { name: "Access denied" }),
      ).toBeVisible();
    });
  }
});

// SCRUM-68 — "Requesting another organiser's event by its id must look exactly
// like requesting one that was never there." There is no /events/[id] detail
// route yet (details open in a modal — see events-client.tsx), so both an event
// that belongs to someone else and an id that never existed resolve to the same
// 404. The data-layer ownership rule (getEventForUser) is exercised by the
// organiser2 isolation test in events.spec.ts.
test.describe("SCRUM-68 — another organiser's event is indistinguishable from not-found", () => {
  test("visiting a foreign organiser's event id and a made-up id both 404 identically", async ({
    page,
  }) => {
    await signIn(page, "organiser@test.local");

    // evt_other_organiser is seeded as organiser2's event (prisma/seed.ts).
    const foreign = await page.goto("/events/evt_other_organiser");
    const madeUp = await page.goto("/events/evt_does_not_exist_at_all");

    expect(foreign?.status()).toBe(404);
    expect(madeUp?.status()).toBe(404);
    // Same status: the app never reveals that the foreign event exists.
    expect(foreign?.status()).toBe(madeUp?.status());
  });
});

// SCRUM-66 — "Navigation and on-screen actions are derived from the signed-in
// user's role." Sign in as each of the five seeded roles and assert the nav
// rail shows exactly that role's links (by href, so a label rename won't break
// the test). Absent links are asserted to have zero elements in the rail.
test.describe("SCRUM-66 — each role's navigation shows only its own links", () => {
  const ALL_ROUTES = [
    "/events",
    "/venues",
    "/bookings",
    "/equipment",
    "/registrations",
    "/notifications",
  ] as const;

  const cases: { email: string; role: string; present: string[] }[] = [
    {
      email: "organiser@test.local",
      role: "Organiser",
      present: ["/events", "/notifications"],
    },
    {
      email: "coordinator@test.local",
      role: "Coordinator",
      present: ["/events", "/venues", "/notifications"],
    },
    {
      email: "venuestaff@test.local",
      role: "Venue Staff",
      present: ["/bookings", "/notifications"],
    },
    {
      email: "techsupport@test.local",
      role: "Tech Support",
      present: ["/equipment", "/notifications"],
    },
    {
      email: "attendee@test.local",
      role: "Attendee",
      present: ["/events", "/registrations", "/notifications"],
    },
  ];

  for (const { email, role, present } of cases) {
    test(`${role} sees only ${present.join(", ")}`, async ({ page }) => {
      await signIn(page, email);

      const rail = page.locator("aside");
      for (const href of ALL_ROUTES) {
        const link = rail.locator(`a[href="${href}"]`);
        if (present.includes(href)) {
          await expect(link).toHaveCount(1);
        } else {
          await expect(link).toHaveCount(0);
        }
      }
    });
  }
});

// SCRUM-67 — a protected page must not render for a request that carries no
// session at all; the middleware (proxy.ts) redirects it to /login.
test.describe("SCRUM-67 — signed-out access to a protected URL redirects to login", () => {
  for (const url of ["/events", "/venues", "/bookings", "/equipment"]) {
    test(`${url} bounces a signed-out visitor to /login`, async ({ page }) => {
      await page.goto(url);
      await page.waitForURL("**/login");
      await expect(
        page.getByRole("button", { name: "Sign in" }),
      ).toBeVisible();
    });
  }
});
