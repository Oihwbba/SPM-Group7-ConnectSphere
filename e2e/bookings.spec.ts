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
const PLANNING_EVENT = "evt_planning";

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

  test("SCRUM-50 AC2, SCRUM-52 AC1-3, SCRUM-53 AC1 & AC3 — a coordinator requests, staff approve, and the venue becomes unavailable", async ({
    browser,
  }, testInfo) => {
    const tag = `e2e-journey-${testInfo.retry}`;

    // SCRUM-50 AC2 — a free period is submitted and shown as pending.
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await openRequestForm(coordinator);
    await requestHall(coordinator, {
      eventId: APPROVED_EVENT,
      start: "2035-03-10T09:00",
      end: "2035-03-10T13:00",
      notes: tag,
    });
    await expect(coordinator.getByTestId("booking-outcome")).toContainText(
      "Request submitted — pending a Venue Staff decision",
    );

    // SCRUM-50 AC6 — submitting it again shows the existing request instead.
    await coordinator.getByRole("button", { name: "Submit request" }).click();
    await expect(coordinator.getByTestId("booking-outcome")).toContainText(
      "You already have a pending request for this venue and period",
    );

    // SCRUM-52 — staff see it with what they need to decide.
    const staff = await signedIn(browser, "venuestaff@test.local");
    await staff.goto("/bookings");
    const card = staff.getByTestId(/^booking-/).filter({ hasText: tag });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("Exhibition Hall");
    await expect(card).toContainText(
      "10 Mar 2035, 9:00 am to 10 Mar 2035, 1:00 pm",
    );
    await expect(card).toContainText("120 expected · venue holds 200");
    await expect(card).toContainText(
      "Cody Coordinator (coordinator@test.local)",
    );
    await expect(card).toContainText("Free for this period");

    // SCRUM-53 AC1 — approve.
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(
      staff.getByText(/^Approved: Exhibition Hall is now booked/),
    ).toBeVisible();
    await expect(card).toHaveCount(0);

    // SCRUM-53 AC3 / SCRUM-50 AC3 — the period is now unavailable.
    await openRequestForm(coordinator);
    await requestHall(coordinator, {
      eventId: PLANNING_EVENT,
      start: "2035-03-10T11:00",
      end: "2035-03-10T15:00",
    });
    const refusal = coordinator.getByTestId("booking-outcome");
    await expect(refusal).toContainText("Request not submitted");
    await expect(refusal).toContainText(
      "Exhibition Hall is unavailable for that period: already booked from 10 Mar 2035, 9:00 am to 10 Mar 2035, 1:00 pm.",
    );
    await testInfo.attach("SCRUM-50 refusal when the venue is already booked", {
      body: await coordinator.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    if (process.env.EVIDENCE_DIR) {
      await coordinator.screenshot({
        path: `${process.env.EVIDENCE_DIR}/SCRUM-50-venue-unavailable-refusal.png`,
        fullPage: true,
      });
    }

    // SCRUM-50 AC4 — a period beginning exactly when the booking ends is accepted.
    await coordinator
      .getByLabel("Start", { exact: true })
      .fill("2035-03-10T13:00");
    await coordinator
      .getByLabel("End", { exact: true })
      .fill("2035-03-10T15:00");
    await coordinator.getByRole("button", { name: "Submit request" }).click();
    await expect(coordinator.getByTestId("booking-outcome")).toContainText(
      "Request submitted",
    );
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

  test("SCRUM-53 AC2 — rejecting needs a written reason, and the reason is saved", async ({
    browser,
  }, testInfo) => {
    const tag = `e2e-reject-${testInfo.retry}`;
    const coordinator = await signedIn(browser, "coordinator@test.local");
    await openRequestForm(coordinator);
    await requestHall(coordinator, {
      eventId: APPROVED_EVENT,
      start: "2035-05-01T09:00",
      end: "2035-05-01T12:00",
      notes: tag,
    });
    await expect(coordinator.getByTestId("booking-outcome")).toContainText(
      "Request submitted",
    );

    const staff = await signedIn(browser, "venuestaff@test.local");
    await staff.goto("/bookings");
    const card = staff.getByTestId(/^booking-/).filter({ hasText: tag });
    await card.getByRole("button", { name: "Reject" }).click();

    const confirm = staff.getByRole("button", { name: "Reject request" });
    await expect(confirm).toBeDisabled();
    await staff.getByLabel("Rejection reason").fill("   ");
    await expect(confirm).toBeDisabled();

    await staff
      .getByLabel("Rejection reason")
      .fill("The hall is set for an exhibition that week.");
    await confirm.click();
    await expect(staff.getByText("Rejected the request for")).toBeVisible();
    await expect(card).toHaveCount(0);

    if (usesLocalDatabase) {
      const saved = await prisma.booking.findFirstOrThrow({
        where: { requestNotes: tag },
        select: { status: true, decisionReason: true },
      });
      expect(saved).toEqual({
        status: "REJECTED",
        decisionReason: "The hall is set for an exhibition that week.",
      });
    }
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
