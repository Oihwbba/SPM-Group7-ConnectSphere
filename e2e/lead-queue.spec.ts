import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

/**
 * SCRUM-165 — a submitted request waits in the Lead's Unassigned queue until
 * the Lead assigns a Coordinator (replaces SCRUM-20's automatic assignment).
 */
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

async function signInAs(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test.describe("SCRUM-165 — Lead assigns new requests from an unassigned queue", () => {
  // Submits a real request, so it runs only against a local database (CI's).
  test.skip(!usesLocalDatabase, "writes events; local database only");

  const eventName = `SCRUM-165 Queue Test ${Date.now()}`;

  test.afterEach(async () => {
    const eventIds = (
      await prisma.event.findMany({
        where: { name: { startsWith: "SCRUM-165 Queue Test" } },
        select: { id: true },
      })
    ).map((e) => e.id);
    await prisma.notification.deleteMany({
      where: { eventId: { in: eventIds } },
    });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
  });

  test("SCRUM-165 [AC1–AC5, AC8, AC11] TC-165-01, TC-165-02, TC-165-04, TC-165-05, TC-165-07, TC-165-11, TC-165-14: a submitted request waits in the queue, the Lead assigns it, and only then does the Coordinator get it", async ({
    page,
  }) => {
    // The Organiser submits a complete request (same flow as SCRUM-14's spec).
    await signInAs(page, "organiser@test.local");
    await page
      .getByRole("button", { name: /Create Event Request/i })
      .first()
      .click();
    await page.getByLabel("Event Name *").fill(eventName);
    await page.getByLabel("Event Purpose *").fill("Verify the Lead's queue.");
    await page
      .getByLabel("Event Description *")
      .fill("SCRUM-165 end-to-end coverage.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page
      .getByLabel("Proposed Start Date & Time *")
      .fill("2031-11-01T09:00");
    await page
      .getByLabel("Proposed End Date & Time *")
      .fill("2031-11-01T17:00");
    await page.getByLabel("Expected Attendance *").fill("50");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByLabel("Venue Requirements *").fill("Any mid-size room.");
    await page.getByLabel("Preferred Room Layout *").fill("Classroom");
    await page
      .getByLabel("Accessibility Needs *")
      .fill("Wheelchair accessible entrance.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page
      .getByLabel("Equipment & Technical Support Requirements *")
      .fill("Projector.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page
      .getByLabel("Registration Needs *")
      .fill("Standard online registration.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page
      .getByRole("button", { name: /Submit Request for Review/i })
      .click();
    await expect(page.getByRole("cell", { name: eventName })).toBeVisible();

    // AC1: nobody is assigned; it stays Submitted.
    const submitted = await prisma.event.findFirstOrThrow({
      where: { name: eventName },
    });
    expect(submitted.status).toBe("SUBMITTED");
    expect(submitted.coordinatorId).toBeNull();

    // AC8: a Coordinator doesn't see it in their list.
    await signInAs(page, "coordinator@test.local");
    await expect(page.getByRole("cell", { name: eventName })).toHaveCount(0);

    // AC2: the Lead lands on the queue and sees it with its Organiser.
    await signInAs(page, "lead@test.local");
    await expect(page).toHaveURL(/\/queue$/);
    const entry = page
      .getByTestId("queue-request")
      .filter({ hasText: eventName });
    await expect(entry).toContainText("Olivia Organiser");
    await expect(entry).toContainText("50 expected");

    // AC3: opening it shows its basic information.
    await entry.click();
    await expect(page.getByRole("heading", { name: eventName })).toBeVisible();
    await expect(page.getByTestId("request-details")).toContainText(
      "Verify the Lead's queue.",
    );

    // AC4: each Coordinator shows their active events; pick Cody.
    const choice = page.getByLabel("Coordinator");
    await expect(choice.locator("option")).toContainText([/active event/]);
    await choice.selectOption("usr_coordinator");
    await page.getByTestId("assign-button").click();
    await page.waitForURL("**/queue");
    await expect(
      page.getByTestId("queue-request").filter({ hasText: eventName }),
    ).toHaveCount(0);

    // AC5, AC11: assigned, Under Review, with this Lead as supervisor.
    const assigned = await prisma.event.findFirstOrThrow({
      where: { name: eventName },
    });
    expect(assigned.status).toBe("UNDER_REVIEW");
    expect(assigned.coordinatorId).toBe("usr_coordinator");
    expect(assigned.supervisingLeadId).toBe("usr_coordinatorlead");

    // AC5: the Coordinator now has it in their list.
    await signInAs(page, "coordinator@test.local");
    await expect(page.getByRole("cell", { name: eventName })).toBeVisible();
  });

  test("SCRUM-165 [AC10] TC-165-13: a Coordinator typing /queue directly is refused", async ({
    page,
  }) => {
    await signInAs(page, "coordinator@test.local");
    await page.goto("/queue");

    await expect(
      page.getByRole("heading", { name: "Access denied" }),
    ).toBeVisible();
  });
});
