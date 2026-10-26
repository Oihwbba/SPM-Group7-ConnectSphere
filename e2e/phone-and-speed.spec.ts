import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { signedIn, usesLocalDatabase, pickDateTime, selectFrom, openEvent } from "./helpers";

/**
 * SCRUM-132 — the core pages work on a phone (AC1), the main operations
 * respond within 2 seconds on the seed data (AC2), and an event's status,
 * arrangements and outstanding actions show without scrolling on a desktop
 * (AC3). 360 px and 2 seconds are the team's own limits; the briefing gives
 * no numbers. Test cases: docs/testing/SCRUM-132.md.
 */

const PHONE = { width: 360, height: 740 };
const LIMIT_MS = 2000;

/** Pixels the page is wider than the window: a horizontal scroll if above 0. */
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

async function onPhone(browser: Browser, email: string | null) {
  if (email === null) return browser.newPage({ viewport: PHONE });
  const page = await signedIn(browser, email);
  await page.setViewportSize(PHONE);
  return page;
}

/** SCRUM-208: the event's page, on the tab this journey works in. */
async function openDetails(page: Page, eventName: string, tab = "Arrangements") {
  return openEvent(page, eventName, tab);
}

/**
 * An open dialog must fit the window, and nothing in it may reach past the
 * window's edge, as a row scrolling sideways inside it would. Polled, since
 * the dialog zooms in as it opens.
 */
async function expectDialogFits(page: Page) {
  await expect
    .poll(() =>
      page.getByRole("dialog").first().evaluate((dialog) => {
        let right = dialog.getBoundingClientRect().right;
        for (const el of dialog.querySelectorAll("*")) {
          const box = el.getBoundingClientRect();
          if (box.width > 0) right = Math.max(right, box.right);
        }
        return Math.round(right);
      }),
    )
    .toBeLessThanOrEqual(PHONE.width);
}

test.describe("SCRUM-132 [AC1] core pages at 360 px", () => {
  const h1 = (name?: string) => (page: Page) =>
    page.getByRole("heading", { level: 1, ...(name && { name }) });
  // What shows once each page has rendered its content.
  const pages: { name: string; email: string | null; path: string; ready: (page: Page) => Locator }[] = [
    { name: "sign-in", email: null, path: "/login", ready: h1("Welcome back") },
    { name: "My Event Requests", email: "organiser@test.local", path: "/events", ready: h1("My Events") },
    { name: "venue search", email: "coordinator@test.local", path: "/venues/search?event=evt_planning&searched=1", ready: (page) => page.getByTestId("venue-result").first() },
    { name: "venue availability", email: "coordinator@test.local", path: "/venues/availability?venue=ven_hall", ready: h1("Venue availability") },
    { name: "booking review", email: "venuestaff@test.local", path: "/bookings", ready: h1() },
    { name: "equipment review", email: "techsupport@test.local", path: "/equipment-requests", ready: h1() },
    { name: "all-events list", email: "lead@test.local", path: "/all-events", ready: h1() },
    { name: "event browse", email: "attendee@test.local", path: "/events", ready: (page) => page.getByTestId("browsable-event-card").first() },
    { name: "my registrations", email: "attendee@test.local", path: "/registrations", ready: h1() },
    { name: "notifications", email: "organiser@test.local", path: "/notifications", ready: h1() },
    { name: "Unassigned queue", email: "lead@test.local", path: "/queue", ready: h1() },
  ];

  for (const { name, email, path, ready } of pages) {
    test(`SCRUM-132 [AC1] TC-132-01: ${name} has no horizontal scroll at 360 px`, async ({
      browser,
    }) => {
      const page = await onPhone(browser, email);
      await page.goto(path);
      await expect(ready(page)).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    });
  }

  test("SCRUM-132 [AC1] TC-132-01: the event detail has no horizontal scroll at 360 px", async ({
    browser,
  }) => {
    const page = await onPhone(browser, "coordinator@test.local");
    await page.goto("/events");
    // SCRUM-208: the event is a page, so nothing on it may scroll sideways.
    const details = await openDetails(page, "Planning — Freshman Orientation");
    await expect(details.getByTestId("readiness-checklist")).toBeVisible();
    await expect(details.getByText("Checking arrangements…")).toHaveCount(0);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test("SCRUM-132 [AC1] TC-132-01: the request form has no horizontal scroll at 360 px", async ({
    browser,
  }) => {
    const page = await onPhone(browser, "organiser@test.local");
    await page.goto("/events");
    await page.getByRole("button", { name: /Create Event Request/i }).first().click();
    await expect(page.getByRole("dialog").first()).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await expectDialogFits(page);
  });

  test.describe("the safety review page", () => {
    test.skip(!usesLocalDatabase, "writes its own safety check; local database only");

    let checkId: string;
    test.beforeAll(async () => {
      const check = await prisma.safetyCheck.create({
        data: { eventId: "evt_planning", requestedById: "usr_coordinator" },
        select: { id: true },
      });
      checkId = check.id;
    });
    test.afterAll(async () => {
      await prisma.safetyCheck.deleteMany({ where: { id: checkId } });
    });

    test("SCRUM-132 [AC1] TC-132-01: the safety checks list and review page have no horizontal scroll at 360 px", async ({
      browser,
    }) => {
      const page = await onPhone(browser, "safety@test.local");
      await page.goto("/safety-checks");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await overflow(page)).toBeLessThanOrEqual(0);

      await page.goto(`/safety-checks/${checkId}`);
      await expect(page.getByTestId("safety-check-status")).toBeVisible();
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    });
  });
});

/**
 * AC2 — each operation timed from the user's action until its answer is on
 * screen, against the production build the e2e run serves. The timings are
 * attached to the run's report, which is the sprint review's evidence.
 */
test.describe("SCRUM-132 [AC2] operations respond within 2 seconds", () => {
  async function timed(name: string, run: () => Promise<void>) {
    const started = Date.now();
    await run();
    const ms = Date.now() - started;
    await test.info().attach(`${name} (ms)`, { body: String(ms), contentType: "text/plain" });
    console.log(`SCRUM-132 AC2 timing: ${name}: ${ms} ms`);
    expect(ms, `${name} took ${ms} ms`).toBeLessThanOrEqual(LIMIT_MS);
  }

  test("SCRUM-132 [AC2] TC-132-02: viewing an event, searching venues and opening a venue's availability each respond within 2 seconds", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "coordinator@test.local");
    await page.goto("/events");
    await expect(page.getByRole("row", { name: /Planning — Freshman Orientation/ })).toBeVisible();

    await timed("view an event", async () => {
      const details = await openDetails(page, "Planning — Freshman Orientation");
      await expect(details.getByTestId("readiness-item-venue")).toBeVisible();
    });
    await page.keyboard.press("Escape");

    await timed("search venues", async () => {
      await page.goto("/venues/search?event=evt_planning&searched=1");
      await expect(page.getByTestId("venue-result").first()).toBeVisible();
    });

    await timed("open a venue's availability", async () => {
      await page.goto("/venues/availability?venue=ven_hall");
      await expect(page.getByRole("heading", { name: "Venue availability" })).toBeVisible();
      await expect(page.getByRole("list", { name: "Legend" })).toBeVisible();
    });
  });

  test("SCRUM-132 [AC2] TC-132-03: checking equipment availability responds within 2 seconds", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "techsupport@test.local");
    await page.goto("/equipment");
    await pickDateTime(page.getByLabel("Start", { exact: true }), "2032-08-18T09:00");
    await pickDateTime(page.getByLabel("End", { exact: true }), "2032-08-18T12:00");
    await page.getByLabel("Quantity", { exact: true }).fill("1");

    await timed("check equipment availability", async () => {
      await selectFrom(page.getByLabel("Equipment type"), { value: "eqp_projector" });
      await expect(page.getByTestId("selected-availability")).toHaveText(/of \d+ available/);
    });
  });

  test.describe("registration", () => {
    test.skip(!usesLocalDatabase, "writes its own event; local database only");

    let eventId: string;
    const eventName = `SCRUM-132 Timing ${Date.now()}`;
    test.beforeAll(async () => {
      const event = await prisma.event.create({
        data: {
          name: eventName,
          purpose: "SCRUM-132 timing",
          description: "Owned by the SCRUM-132 e2e spec.",
          status: "CONFIRMED",
          organiserId: "usr_organiser",
          coordinatorId: "usr_coordinator",
          startAt: new Date("2031-09-02T02:00:00Z"),
          endAt: new Date("2031-09-02T10:00:00Z"),
          expectedAttendance: 5,
          registrationEnabled: true,
        },
        select: { id: true },
      });
      eventId = event.id;
    });
    test.afterAll(async () => {
      await prisma.registration.deleteMany({ where: { eventId } });
      await prisma.notification.deleteMany({ where: { eventId } });
      await prisma.auditLog.deleteMany({ where: { entityId: eventId } });
      await prisma.event.deleteMany({ where: { id: eventId } });
    });

    test("SCRUM-132 [AC2] TC-132-04: submitting a registration responds within 2 seconds", async ({
      browser,
    }) => {
      const page = await signedIn(browser, "attendee4@test.local");
      await page.goto(`/events/${eventId}`);
      await expect(page.getByRole("heading", { name: eventName })).toBeVisible();

      await timed("submit a registration", async () => {
        await page.getByTestId("register-button").click();
        await expect(page.getByTestId("already-registered")).toBeVisible();
      });
    });
  });
});

test.describe("SCRUM-132 [AC3] the event detail on a desktop screen", () => {
  test("SCRUM-132 [AC3] TC-132-05: a Planning event's status and outstanding actions show without scrolling", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "coordinator@test.local");
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/events");
    const details = await openDetails(page, "Planning — Freshman Orientation");

    await expect(details.getByTestId("status-badge")).toBeInViewport();
    const checklist = details.getByTestId("readiness-checklist");
    await expect(checklist.getByTestId("readiness-item-venue")).toBeInViewport();
    await expect(checklist.getByTestId("readiness-item-equipment")).toBeInViewport();
    await expect(checklist.getByTestId("readiness-item-safety")).toBeInViewport();
    await expect(checklist.getByRole("button", { name: "Confirm event" })).toBeInViewport();
  });

  test("SCRUM-132 [AC3] TC-132-06: a Confirmed event's status and confirmed arrangements show without scrolling", async ({
    browser,
  }) => {
    const page = await signedIn(browser, "organiser@test.local");
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/events");
    const details = await openDetails(page, "Confirmed — Charity Gala");

    await expect(details.getByTestId("status-badge")).toBeInViewport();
    await expect(details.getByTestId("confirmed-venue")).toBeInViewport();
    await expect(details.getByTestId("confirmed-equipment")).toBeInViewport();
  });
});
