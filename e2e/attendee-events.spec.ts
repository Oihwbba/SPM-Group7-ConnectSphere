import { test, expect } from "@playwright/test";

/**
 * SCRUM-72 — Attendee browses Confirmed events and sees registration
 * availability. Entirely read-only against stable seeded fixtures (no event
 * is created or mutated here), so unlike the writing specs elsewhere in this
 * suite it needs no local-database guard and no cleanup — it's safe to run
 * against the shared database.
 *
 * Fixtures used (prisma/seed.ts):
 *   evt_confirmed   — Confirmed, 120 capacity, 2 active + 1 withdrawn → OPEN
 *   evt_full        — Confirmed, 3/3 registered → FULL, still visible
 *   evt_last_seat   — Confirmed, 2/3 registered → OPEN, exactly 1 remaining
 *   evt_reg_not_open— Confirmed, registrationOpensAt in the future
 *   evt_reg_closed  — Confirmed, registrationClosesAt in the past
 *   evt_cancelled   — Cancelled → must NOT appear in the browse list at all
 */
// e.g. "16 Oct 2026, 9:00 am SGT – 1:00 pm SGT": a date, then the start and
// end times (SCRUM-72 AC2).
const SAME_DAY_TIME =
  /^\d{1,2}\s\w+\s\d{4},\s\d{1,2}:\d{2}\s[ap]m\sSGT\s–\s\d{1,2}:\d{2}\s[ap]m\sSGT$/;

test.describe("SCRUM-72 — Attendee browses confirmed events", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("attendee@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/events");
  });

  test("AC: browse list shows Confirmed events with venue, capacity and registration state; excludes Cancelled", async ({
    page,
  }) => {
    const galaCard = page.getByTestId("browsable-event-card").filter({
      hasText: "Confirmed — Charity Gala",
    });
    await expect(galaCard).toBeVisible();
    await expect(galaCard.getByTestId("venue")).toContainText(
      "Exhibition Hall",
    );
    // AC2: date with start and end time. The gala starts and ends the same
    // day in the seed, so the end shows as a time only.
    await expect(galaCard.getByTestId("event-date")).toHaveText(SAME_DAY_TIME);
    // 120 capacity, 2 REGISTERED (1 WITHDRAWN does not count) = 118 remaining.
    await expect(galaCard.getByTestId("remaining-capacity")).toHaveText(
      "118 of 120 places remaining",
    );
    await expect(galaCard.getByTestId("registration-state-badge")).toHaveText(
      "Open",
    );

    // AC: "A full event remains visible and is shown as full rather than
    // disappearing from the browse list."
    const fullCard = page.getByTestId("browsable-event-card").filter({
      hasText: "Full — Wine Tasting Evening",
    });
    await expect(fullCard).toBeVisible();
    await expect(fullCard.getByTestId("remaining-capacity")).toHaveText(
      "0 of 3 places remaining",
    );
    await expect(fullCard.getByTestId("registration-state-badge")).toHaveText(
      "Full",
    );

    // Boundary: exactly one place left is still OPEN, not FULL.
    const lastSeatCard = page.getByTestId("browsable-event-card").filter({
      hasText: "One Place Left — Studio Masterclass",
    });
    await expect(lastSeatCard.getByTestId("remaining-capacity")).toHaveText(
      "1 of 3 places remaining",
    );
    await expect(
      lastSeatCard.getByTestId("registration-state-badge"),
    ).toHaveText("Open");

    // AC: not-yet-open and expired periods stay visible with the state shown.
    // AC: "The registration period ... are shown" — not just the derived
    // state, the actual configured dates.
    const notOpenCard = page.getByTestId("browsable-event-card").filter({
      hasText: "Registration Not Yet Open — Summer Camp",
    });
    await expect(
      notOpenCard.getByTestId("registration-state-badge"),
    ).toHaveText("Registration not yet open");
    await expect(notOpenCard.getByTestId("registration-period")).toContainText(
      "Opens",
    );

    const closedCard = page.getByTestId("browsable-event-card").filter({
      hasText: "Registration Closed — Leadership Retreat",
    });
    await expect(closedCard.getByTestId("registration-state-badge")).toHaveText(
      "Registration closed",
    );
    await expect(closedCard.getByTestId("registration-period")).toContainText(
      "Closes",
    );

    // AC: "An event that is Cancelled no longer appears in the attendee
    // browse list."
    await expect(
      page.getByText("Cancelled — Winter Workshop"),
    ).not.toBeVisible();
  });

  test("AC: opening a full event's detail page shows it as full with the register action disabled", async ({
    page,
  }) => {
    // attendee@test.local (this describe's default, via beforeEach) is
    // itself one of evt_full's 3 registrations, so it would see
    // "already-registered" instead of a register-button — sign in instead as
    // attendee4, the account the seed leaves deliberately unregistered
    // everywhere, so this actually exercises the disabled-action state.
    await page.context().clearCookies();
    await page.goto("/login");
    await page
      .getByLabel("Email", { exact: true })
      .fill("attendee4@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/events");

    const fullCard = page.getByTestId("browsable-event-card").filter({
      hasText: "Full — Wine Tasting Evening",
    });
    await fullCard.click();

    await expect(
      page.getByRole("heading", { name: "Full — Wine Tasting Evening" }),
    ).toBeVisible();
    await expect(page.getByTestId("registration-state-badge")).toHaveText(
      "Full",
    );
    await expect(page.getByTestId("venue")).toContainText(
      "Executive Boardroom",
    );
    await expect(page.getByTestId("remaining-capacity")).toHaveText(
      "0 of 3 places remaining",
    );
    await expect(page.getByTestId("register-button")).toBeDisabled();
    await expect(
      page.getByText(
        "This event is full. You can check back in case a place opens up.",
      ),
    ).toBeVisible();
  });

  test("AC: an open event's detail page shows the registration period and an honestly-disabled Register button", async ({
    page,
  }) => {
    const notOpenCard = page.getByTestId("browsable-event-card").filter({
      hasText: "Registration Not Yet Open — Summer Camp",
    });
    await notOpenCard.click();

    await expect(
      page.getByRole("heading", {
        name: "Registration Not Yet Open — Summer Camp",
      }),
    ).toBeVisible();
    await expect(page.getByTestId("registration-period")).toContainText(
      "Opens",
    );
    await expect(page.getByTestId("event-date")).toHaveText(SAME_DAY_TIME);
    // SCRUM-73 owns the actual register action — the button exists so the
    // control isn't invisible, but it must never look clickable-but-dead.
    await expect(page.getByTestId("register-button")).toBeDisabled();
  });

  test("AC: direct event URLs do not bypass visibility rules — a Cancelled event 404s for an Attendee", async ({
    page,
  }) => {
    const response = await page.goto("/events/evt_cancelled");
    expect(response?.status()).toBe(404);
  });

  for (const id of ["evt_draft", "evt_planning", "evt_completed"]) {
    test(`AC7, AC8: going straight to /events/${id} (not Confirmed) 404s`, async ({
      page,
    }) => {
      const response = await page.goto(`/events/${id}`);
      expect(response?.status()).toBe(404);
    });
  }

  for (const { id, label } of [
    { id: "evt_reg_closed", label: "Registration closed" },
    { id: "evt_reg_not_open", label: "Registration not yet open" },
  ]) {
    test(`AC4, AC8: going straight to /events/${id} shows "${label}" with Register disabled`, async ({
      page,
    }) => {
      // attendee4 holds no registrations in the seed, so the Register button
      // is shown rather than "You're registered".
      await page.context().clearCookies();
      await page.goto("/login");
      await page
        .getByLabel("Email", { exact: true })
        .fill("attendee4@test.local");
      await page.getByLabel("Password", { exact: true }).fill("Password123!");
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL("**/events");

      const response = await page.goto(`/events/${id}`);
      expect(response?.status()).toBe(200);
      await expect(page.getByTestId("registration-state-badge")).toHaveText(
        label,
      );
      await expect(page.getByTestId("register-button")).toBeDisabled();
    });
  }

  test("SCRUM-72 review: typing a keyword narrows the list to matching events, ignoring case", async ({
    page,
  }) => {
    const search = page.getByLabel("Search events by name or description");

    await search.fill("WINE");
    await expect(
      page.getByText("Full — Wine Tasting Evening", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Registration Not Yet Open — Summer Camp", {
        exact: true,
      }),
    ).not.toBeVisible();

    await search.fill("no event is called this");
    await expect(page.getByText("No events match your search.")).toBeVisible();

    await search.fill("");
    await expect(
      page.getByText("Registration Not Yet Open — Summer Camp", {
        exact: true,
      }),
    ).toBeVisible();
  });

  test("a non-existent event id 404s the same way as a real but invisible one", async ({
    page,
  }) => {
    const response = await page.goto("/events/evt_does_not_exist_at_all");
    expect(response?.status()).toBe(404);
  });
});

test.describe("SCRUM-72 — the attendee detail route stays 404 for other roles", () => {
  test("an Organiser hitting a Confirmed event's attendee-detail URL still 404s (unchanged pre-existing behaviour)", async ({
    page,
  }) => {
    await page.goto("/login");
    await page
      .getByLabel("Email", { exact: true })
      .fill("organiser@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/events");

    const response = await page.goto("/events/evt_confirmed");
    expect(response?.status()).toBe(404);
  });
});
