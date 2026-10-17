import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";

/**
 * End-to-End Test for SCRUM-20 — Auto-assign a coordinator to a submitted event.
 *
 * The fairness rule picks the least-loaded coordinator, and which seeded
 * account that is can shift as the seed data changes — so this test reads
 * the actual database state after submission rather than asserting a
 * specific coordinator's name.
 */
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

test.describe("SCRUM-20 — Auto-assign a coordinator", () => {
  // The test submits a real event, so against the shared Supabase database it
  // would write production rows — and every leftover UNDER_REVIEW event would
  // add to a coordinator's load and skew later auto-assignments.
  test.skip(!usesLocalDatabase, "writes events; local database only");

  test.afterEach(async () => {
    const eventIds = (
      await prisma.event.findMany({
        where: { name: { startsWith: "SCRUM-20 Assignment Test" } },
        select: { id: true },
      })
    ).map((e) => e.id);
    await prisma.notification.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
  });

  test("submitting an event automatically assigns exactly one coordinator and moves it to Under Review, with no accept/decline step", async ({
    page,
  }) => {
    // 1. Sign in as the seeded organiser
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("organiser@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/events");

    const eventName = `SCRUM-20 Assignment Test ${Date.now()}`;

    // 2. Fill and submit a complete event request (same flow as SCRUM-14's spec)
    await page.getByRole("button", { name: /Create Event Request/i }).first().click();

    await page.getByLabel("Event Name *").fill(eventName);
    await page.getByLabel("Event Purpose *").fill("Verify auto-assignment on submit.");
    await page.getByLabel("Event Description *").fill("SCRUM-20 end-to-end coverage.");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.getByLabel("Proposed Start Date & Time *").fill("2027-11-01T09:00");
    await page.getByLabel("Proposed End Date & Time *").fill("2027-11-01T17:00");
    await page.getByLabel("Expected Attendance *").fill("50");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.getByLabel("Venue Requirements *").fill("Any mid-size room.");
    await page.getByLabel("Preferred Room Layout *").fill("Classroom");
    await page.getByLabel("Accessibility Needs *").fill("Wheelchair accessible entrance.");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.getByLabel("Equipment & Technical Support Requirements *").fill("Projector.");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // SCRUM-171 AC1: Registration needed is required to submit; the note is optional.
    await page.getByRole("group", { name: "Registration Needed *" }).getByLabel("Yes").check();
    await page.getByLabel("Registration Notes (Optional)").fill("Standard online registration.");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await expect(page.getByRole("heading", { name: /Review Entered Details/i })).toBeVisible();
    await page.getByRole("button", { name: /Submit Request for Review/i }).click();

    // 3. AC: it becomes visible to Event Coordinators — confirm it landed
    await expect(page.getByRole("cell", { name: eventName })).toBeVisible();

    // 4. AC: exactly one coordinator is assigned automatically, status moves
    // to Under Review, no accept/decline step — check the database directly,
    // since which coordinator "wins" the fairness rule is not fixed by name.
    const event = await prisma.event.findFirst({ where: { name: eventName } });
    expect(event).not.toBeNull();
    expect(event!.status).toBe("UNDER_REVIEW");
    expect(event!.coordinatorId).not.toBeNull();

    // 5. AC: the assigned coordinator can now see it in their own queue,
    // with nothing to accept — it's simply there.
    const coordinator = await prisma.user.findUnique({
      where: { id: event!.coordinatorId! },
    });
    expect(coordinator).not.toBeNull();

    await page.getByRole("button", { name: "Open user menu" }).click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();
    await page.waitForURL("**/login");
    await page.getByLabel("Email", { exact: true }).fill(coordinator!.email);
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/events");

    await expect(page.getByRole("cell", { name: eventName })).toBeVisible();
  });

  test("when no coordinators exist, the event still reaches Submitted rather than failing", async () => {
    // AC: "Given no Coordinator is available to assign, when an event is
    // submitted, then the event still reaches submitted and is visible to
    // Coordinators rather than failing silently."
    //
    // This is covered at the unit level (tests/unit/event-auto-assignment.test.ts,
    // "no coordinator available" case) rather than here, because temporarily
    // deleting every seeded Coordinator would corrupt the shared Supabase
    // database for every other test and teammate running against it.
    test.skip(
      true,
      "Covered by tests/unit/event-auto-assignment.test.ts — would require deleting all seeded Coordinators from the shared database.",
    );
  });
});