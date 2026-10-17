import { test, expect, type Page } from "@playwright/test";

/**
 * SCRUM-66 / SCRUM-67 — access control at the route and UI level.
 *
 * The happy path (a role reaches its own landing page) is covered by
 * events.spec.ts and equipment.spec.ts. This file pins the *negative* space:
 *
 *  - SCRUM-67: typing another role's URL directly is refused server-side, even
 *    though the UI never offered the link.
 *  - SCRUM-66: on-screen actions (Approve / Reject) are gated by role, and each
 *    role's navigation shows only that role's links.
 *  - SCRUM-67: a signed-out request to a protected URL bounces to /login.
 *
 * It also pins that no per-event detail route exists (see that block for why it
 * carries no SCRUM-68 label). Passwords come from the seed (prisma/seed.ts) —
 * every account shares "Password123!".
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
    // SCRUM-34 AC2: every internal role reads the catalogue; the Organiser doesn't.
    { label: "staff-only venues page", url: "/venues" },
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

// There is no /events/[id] detail route — event details open in a modal (see
// events-client.tsx). This test only pins that fact: any per-event URL 404s
// from routing, whether the id belongs to another organiser or to nothing at
// all. It deliberately makes NO claim about the ownership filter (it would pass
// even if that filter were removed), so it carries no SCRUM-68 label.
//
// SCRUM-68's actual ownership rule — that another organiser's event is
// indistinguishable from a non-existent one — is covered at the data layer by
// tests/unit/event-access.test.ts, and end-to-end by the organiser2 isolation
// test in events.spec.ts.
test.describe("no event detail route is exposed by identifier", () => {
  test("a per-event URL 404s from routing, for any id", async ({ page }) => {
    await signIn(page, "organiser@test.local");

    // evt_other_organiser is seeded as organiser2's event (prisma/seed.ts).
    const foreign = await page.goto("/events/evt_other_organiser");
    const madeUp = await page.goto("/events/evt_does_not_exist_at_all");

    expect(foreign?.status()).toBe(404);
    expect(madeUp?.status()).toBe(404);
  });
});

// SCRUM-66 — "Navigation and on-screen actions are derived from the signed-in
// user's role." The nav half is checked below; this block checks the on-screen
// *actions* half on the events list: the Approve / Reject controls are a
// coordinator-only decision (events-client.tsx), so an organiser must never see
// them, and a coordinator with a submitted request in view must.
test.describe("SCRUM-66 — on-screen actions are gated by role", () => {
  test("an organiser sees no coordinator decision controls on /events", async ({
    page,
  }) => {
    await signIn(page, "organiser@test.local");
    await page.waitForURL("**/events");
    await expect(
      page.getByRole("heading", { name: "My Events" }),
    ).toBeVisible();

    // Approve / Reject only render for a coordinator on an under-review
    // request — the organiser's own list must offer neither.
    await expect(
      page.getByRole("button", { name: "Approve", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Reject", exact: true }),
    ).toHaveCount(0);
  });

  test("a coordinator sees the decision controls on a request under review", async ({
    page,
  }) => {
    await signIn(page, "coordinator@test.local");
    await page.waitForURL("**/events");
    // The seed assigns "Under Review — Career Fair" to this coordinator, so it
    // shows with the Approve / Reject decision controls (SCRUM-135 AC3, AC4).
    await expect(
      page.getByRole("button", { name: "Approve", exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reject", exact: true }).first(),
    ).toBeVisible();
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
    "/bookings/new",
    "/venues/availability",
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
      present: [
        "/events",
        "/venues",
        "/bookings/new",
        "/venues/availability",
        "/notifications",
      ],
    },
    {
      email: "venuestaff@test.local",
      role: "Venue Staff",
      present: ["/bookings", "/venues/availability", "/notifications", "/venues"],
    },
    {
      email: "techsupport@test.local",
      role: "Tech Support",
      present: ["/equipment", "/notifications", "/venues"],
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
      await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    });
  }
});
