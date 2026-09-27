import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

import { choose, setTime, signedIn, usesLocalDatabase } from "./helpers";

/**
 * SCRUM-36 / SCRUM-37 — the availability calendar and recorded unavailability
 * in a real browser: Venue Staff record maintenance, a Coordinator sees it on
 * the calendar and is refused a request over it, a booking approved beside it
 * appears at once, flush against it, and maintenance over that booking is
 * refused with the clash shown.
 *
 * Uses the Grand Auditorium on 10 Jan 2036, clear of anything seeded, and
 * clears those rows first so a local re-run or a CI retry starts clean.
 */
const AUDITORIUM = "ven_auditorium";
const DAY = "2036-01-10";
const APPROVED_EVENT = "Approved — Research Symposium";

const calendarFor = (venue: string, from: string, to = from) =>
  `/venues/availability?venue=${venue}&from=${from}&to=${to}`;

/** The text stretches listed under one day, in order: [kind, text]. */
async function stretches(page: Page, day: string) {
  const items = page.locator(`li[data-day="${day}"] ul > li`);
  return items.evaluateAll((lis) =>
    lis.map((li) => [
      li.getAttribute("data-kind"),
      (li.textContent ?? "").replace(/\s+/g, " ").trim(),
    ]),
  );
}

async function recordMaintenance(page: Page, start: string, end: string) {
  await page.goto(calendarFor(AUDITORIUM, DAY));
  await page.locator('[data-hydrated="true"]').waitFor();
  await page.getByRole("button", { name: "Record unavailability" }).click();
  await setTime(page, "Start", start);
  await setTime(page, "End", end);
  await choose(page, "Reason", "Maintenance");
  await page
    .getByRole("button", { name: "Record unavailability" })
    .last()
    .click();
}

async function requestAuditorium(page: Page, start: string, end: string) {
  await page.goto("/bookings/new");
  await page.locator('[data-hydrated="true"]').waitFor();
  await choose(page, "Event", APPROVED_EVENT);
  await choose(page, "Venue", /^Grand Auditorium/);
  await setTime(page, "Start", start);
  await setTime(page, "End", end);
  await page.getByLabel("Expected attendance").fill("100");
  await page.getByRole("button", { name: "Submit request" }).click();
}

test.describe("SCRUM-36 / SCRUM-37 — venue availability calendar and recorded unavailability", () => {
  // Two users, the calendar paged out to 2036, and several round trips.
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async () => {
    if (!usesLocalDatabase) return;
    const since = { gte: new Date("2036-01-01T00:00:00.000Z") };
    const bookings = await prisma.booking.findMany({
      where: { venueId: AUDITORIUM, startAt: since },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({
      where: {
        entityType: "Booking",
        entityId: { in: bookings.map((b) => b.id) },
      },
    });
    await prisma.booking.deleteMany({
      where: { id: { in: bookings.map((b) => b.id) } },
    });
    await prisma.venueUnavailability.deleteMany({
      where: { venueId: AUDITORIUM, startAt: since },
    });
  });

  test("SCRUM-37 AC2-5, SCRUM-36 AC3-5 — maintenance is recorded, seen, refused over, sat flush against a booking, and never overwrites one", async ({
    browser,
  }, testInfo) => {
    const staff = await signedIn(browser, "venuestaff@test.local");
    const coordinator = await signedIn(browser, "coordinator@test.local");

    // SCRUM-37 AC2 — Venue Staff record maintenance with a period and a reason.
    await recordMaintenance(staff, `${DAY}T13:00`, `${DAY}T17:00`);
    await expect(
      staff.getByText(
        "Recorded: Grand Auditorium is unavailable for that period.",
      ),
    ).toBeVisible();

    // SCRUM-36 AC4 — the Coordinator sees it as unavailable, labelled as
    // maintenance rather than a booking.
    await coordinator.goto(calendarFor(AUDITORIUM, DAY));
    expect(await stretches(coordinator, DAY)).toEqual([
      ["free", "Available midnight to 1:00 pm"],
      ["unavailability", "Unavailable (maintenance) 1:00 pm to 5:00 pm"],
      ["free", "Available 5:00 pm to midnight"],
    ]);

    // SCRUM-37 AC3 — a request over it is refused, like a booking clash.
    await requestAuditorium(coordinator, `${DAY}T14:00`, `${DAY}T16:00`);
    await expect(coordinator.getByTestId("booking-outcome")).toContainText(
      "Grand Auditorium is unavailable for that period: unavailable (maintenance) from 10 Jan 2036, 1:00 pm to 10 Jan 2036, 5:00 pm.",
    );

    // SCRUM-37 AC5 — a request ending exactly as the maintenance begins is accepted.
    await requestAuditorium(coordinator, `${DAY}T09:00`, `${DAY}T13:00`);
    await expect(coordinator.getByTestId("booking-success")).toContainText(
      "Request submitted",
    );
    await coordinator.getByRole("button", { name: "Done" }).click();

    // Staff approve it.
    await staff.goto("/bookings");
    const card = staff
      .getByTestId(/^booking-/)
      .filter({ hasText: "10 Jan 2036, 9:00 am to 10 Jan 2036, 1:00 pm" });
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(staff.getByText(/^Approved: Grand Auditorium/)).toBeVisible();

    // SCRUM-37 AC1 / SCRUM-36 AC3 / AC5 — the approved booking is on the
    // calendar at once, flush against the maintenance: no gap between them.
    await coordinator.goto(calendarFor(AUDITORIUM, DAY));
    expect(await stretches(coordinator, DAY)).toEqual([
      ["free", "Available midnight to 9:00 am"],
      ["booking", "Booked 9:00 am to 1:00 pm"],
      ["unavailability", "Unavailable (maintenance) 1:00 pm to 5:00 pm"],
      ["free", "Available 5:00 pm to midnight"],
    ]);
    const shot = await coordinator.screenshot({ fullPage: false });
    await testInfo.attach("SCRUM-36 booking and maintenance side by side", {
      body: shot,
      contentType: "image/png",
    });
    if (process.env.EVIDENCE_DIR) {
      await coordinator.screenshot({
        path: `${process.env.EVIDENCE_DIR}/SCRUM-36-booking-and-maintenance.png`,
      });
    }

    // SCRUM-37 AC4 — maintenance over the approved booking is not saved; the
    // clash is shown instead.
    await recordMaintenance(staff, `${DAY}T10:00`, `${DAY}T12:00`);
    await expect(staff.getByTestId("unavailability-outcome")).toContainText(
      "Not recorded: Grand Auditorium is already booked from 10 Jan 2036, 9:00 am to 10 Jan 2036, 1:00 pm.",
    );
    if (usesLocalDatabase) {
      expect(
        await prisma.venueUnavailability.count({
          where: {
            venueId: AUDITORIUM,
            startAt: { gte: new Date(`${DAY}T00:00:00+08:00`) },
          },
        }),
      ).toBe(1);
    }
  });

  test("SCRUM-36 AC6 — a venue with nothing in the range reads as available throughout, not blank", async ({
    browser,
  }) => {
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto(
      calendarFor("ven_boardroom", "2036-06-01", "2036-06-07"),
    );

    await expect(coordinator.getByTestId("range-free")).toContainText(
      "Executive Boardroom is available for the whole range",
    );
    await expect(coordinator.locator("li[data-day]")).toHaveCount(7);
    for (const day of ["2036-06-01", "2036-06-07"]) {
      expect(await stretches(coordinator, day)).toEqual([
        ["free", "Available all day"],
      ]);
    }
  });

  test("SCRUM-36 AC7 — the calendar can be narrowed to a date range", async ({
    browser,
  }) => {
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto(calendarFor("ven_hall", "2036-02-01", "2036-02-03"));

    await expect(coordinator.locator("li[data-day]")).toHaveCount(3);
    await expect(
      coordinator.getByRole("heading", { name: /Exhibition Hall/ }),
    ).toContainText("1 Feb 2036 to 3 Feb 2036");
  });

  test("SCRUM-36 — a screen reader hears the venue and date for each day", async ({
    browser,
  }) => {
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto(calendarFor("ven_hall", "2036-02-01"));

    await expect(
      coordinator.getByRole("listitem", {
        name: "Exhibition Hall, Fri, 1 Feb 2036",
      }),
    ).toBeVisible();
  });

  test("SCRUM-36 — the calendar works at phone width", async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const phone = await context.newPage();
    await phone.goto("/login");
    await phone
      .getByLabel("Email", { exact: true })
      .fill("coordinator@test.local");
    await phone.getByLabel("Password", { exact: true }).fill("Password123!");
    await phone.getByRole("button", { name: "Sign in" }).click();
    await phone.waitForURL((url) => !url.pathname.startsWith("/login"));
    await phone.goto(calendarFor("ven_seminar", "2026-10-07", "2026-10-10"));

    // Nothing is wider than the screen.
    const overflow = await phone.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(phone.locator("li[data-day]").first()).toBeVisible();

    await testInfo.attach("SCRUM-36 calendar at phone width", {
      body: await phone.screenshot({ fullPage: false }),
      contentType: "image/png",
    });
    if (process.env.EVIDENCE_DIR) {
      await phone.screenshot({
        path: `${process.env.EVIDENCE_DIR}/SCRUM-36-calendar-phone-width.png`,
        fullPage: false,
      });
    }
  });

  test("SCRUM-36 / SCRUM-37 — who can see the calendar and record unavailability", async ({
    browser,
  }) => {
    for (const email of ["organiser@test.local", "techsupport@test.local"]) {
      const page = await signedIn(browser, email);
      await page.goto(calendarFor(AUDITORIUM, DAY));
      await expect(
        page.getByRole("heading", { name: "Access denied" }),
      ).toBeVisible();
    }

    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto(calendarFor(AUDITORIUM, DAY));
    await expect(
      coordinator.getByRole("heading", { name: "Venue availability" }),
    ).toBeVisible();
    await expect(
      coordinator.getByRole("button", { name: "Record unavailability" }),
    ).toHaveCount(0);
  });
});
