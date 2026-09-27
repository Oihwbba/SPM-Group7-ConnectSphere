import { test, expect, type Browser, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

/**
 * SCRUM-50 / 52 / 53 — the venue booking journey in a real browser: a
 * Coordinator asks for a venue, Venue Staff see the request and decide, and
 * once approved the venue is unavailable for that period.
 *
 * Uses far-future periods on the Exhibition Hall so nothing seeded is near,
 * and clears those rows first so a local re-run or a CI retry starts clean.
 */
const HALL = "ven_hall";
const APPROVED_EVENT = "evt_approved";

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

async function signedIn(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  return page;
}

async function openRequestForm(page: Page) {
  await page.goto("/bookings/new");
  await page.locator('[data-hydrated="true"]').waitFor();
}

/** Fill and submit the form. Times are Singapore wall time. */
async function requestHall(
  page: Page,
  {
    eventId,
    start,
    end,
    notes = "",
  }: { eventId: string; start: string; end: string; notes?: string },
) {
  await page.getByLabel("Event", { exact: true }).selectOption(eventId);
  await page.getByLabel("Venue", { exact: true }).selectOption(HALL);
  await page.getByLabel("Start", { exact: true }).fill(start);
  await page.getByLabel("End", { exact: true }).fill(end);
  await page.getByLabel("Expected attendance").fill("120");
  await page.getByLabel("Other details for Venue Staff").fill(notes);
  await page.getByRole("button", { name: "Submit request" }).click();
}

test.describe("SCRUM-50 / 52 / 53 — venue booking request, review and decision", () => {
  test.beforeEach(async () => {
    if (!usesLocalDatabase) return;
    const rows = await prisma.booking.findMany({
      where: {
        venueId: HALL,
        startAt: { gte: new Date("2035-01-01T00:00:00.000Z") },
      },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({
      where: { entityType: "Booking", entityId: { in: rows.map((r) => r.id) } },
    });
    await prisma.booking.deleteMany({
      where: { id: { in: rows.map((r) => r.id) } },
    });
  });

  test("SCRUM-50 AC5 — an end before the start is reported as an invalid period", async ({
    browser,
  }) => {
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await openRequestForm(coordinator);
    await requestHall(coordinator, {
      eventId: APPROVED_EVENT,
      start: "2035-04-01T15:00",
      end: "2035-04-01T09:00",
    });

    await expect(coordinator.getByTestId("booking-outcome")).toContainText(
      "The requested period is invalid: the end must be after the start.",
    );
  });

  test("SCRUM-52 — a coordinator typing the queue's address is refused by the server", async ({
    browser,
  }) => {
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await coordinator.goto("/bookings");
    await expect(
      coordinator.getByRole("heading", { name: "Access denied" }),
    ).toBeVisible();
  });

  test("SCRUM-50 — venue staff typing the request form's address are refused by the server", async ({
    browser,
  }) => {
    const staff = await signedIn(browser, "venuestaff@test.local");
    await staff.goto("/bookings/new");
    await expect(
      staff.getByRole("heading", { name: "Access denied" }),
    ).toBeVisible();
  });
});
