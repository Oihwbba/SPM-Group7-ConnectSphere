import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";
import { selectFrom, fillOther, pickDateTime, submitRequest, optionsOf } from "./helpers";

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
    await pickDateTime(page.getByLabel("Proposed Start Date & Time *"), "2031-11-01T09:00");
    await pickDateTime(page.getByLabel("Proposed End Date & Time *"), "2031-11-01T17:00");
    await page.getByLabel("Expected Attendance *").fill("50");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await fillOther(page.getByLabel("Venue Requirements *"), "Any mid-size room.");
    await fillOther(page.getByLabel("Preferred Room Layout *"), "Classroom");
    await fillOther(page.getByLabel("Accessibility Needs *"), "Wheelchair accessible entrance.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await fillOther(page.getByLabel("Equipment & Technical Support Requirements *"), "Projector.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    // SCRUM-171 AC1: Registration needed is required to submit; the note is optional.
    await page
      .getByRole("group", { name: "Registration Needed *" })
      .getByLabel("Yes")
      .check();
    await page
      .getByLabel("Registration Notes (Optional)")
      .fill("Standard online registration.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await submitRequest(page);
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

    // AC2: an older request whose start has already passed is also waiting.
    const overdueName = `SCRUM-165 Queue Test Overdue ${Date.now()}`;
    await prisma.event.create({
      data: {
        name: overdueName,
        purpose: "Waited too long",
        description: "Owned by the SCRUM-165 e2e spec.",
        status: "SUBMITTED",
        organiserId: "usr_organiser",
        startAt: new Date("2020-01-01T01:00:00Z"),
        endAt: new Date("2020-01-01T05:00:00Z"),
        expectedAttendance: 10,
        submittedAt: new Date(submitted.submittedAt!.getTime() - 60 * 60 * 1000),
      },
    });

    // AC2: the Lead lands on the queue and sees it waiting (SCRUM-211: in
    // the four columns every queue shares; the Organiser is in its details).
    await signInAs(page, "lead@test.local");
    await expect(page).toHaveURL(/\/queue$/);
    const entry = page.getByTestId("queue-row").filter({ hasText: eventName });
    await expect(entry.getByTestId("asked")).toHaveText("Needs a Coordinator");
    await expect(entry.getByTestId("event-date")).toHaveText("1 Nov 2031");
    await expect(entry.getByTestId("queue-badge")).toHaveCount(0);

    // AC2: oldest submission first, and the one whose start has passed is Overdue.
    const overdueEntry = page.getByTestId("queue-row").filter({ hasText: overdueName });
    await expect(overdueEntry.getByTestId("queue-badge")).toHaveText("Overdue");
    const rows = await page.getByTestId("queue-row").allTextContents();
    const position = (name: string) => rows.findIndex((t) => t.includes(name));
    expect(position(overdueName)).toBeGreaterThanOrEqual(0);
    expect(position(overdueName)).toBeLessThan(position(eventName));

    // AC3: opening it shows its basic information, on the same page.
    await entry.getByRole("link").click();
    await expect(page.getByRole("heading", { name: eventName })).toBeVisible();
    await expect(page.getByTestId("request-details")).toContainText(
      "Verify the Lead's queue.",
    );
    await expect(page.getByTestId("request-details")).toContainText("Olivia Organiser");

    // AC4: each Coordinator shows their active events, and the least loaded
    // is pre-selected and marked as suggested; pick Cody.
    const choice = page.getByLabel("Coordinator");
    const offered = await optionsOf(choice);
    expect(offered.every((o) => /active event/.test(o.label))).toBe(true);
    const suggested = offered.filter((o) => o.label.includes("(suggested)"));
    expect(suggested).toHaveLength(1);
    await expect(choice).toHaveAttribute("data-value", suggested[0].value);
    await selectFrom(choice, "usr_coordinator");
    await page.getByTestId("assign-button").click();
    // SCRUM-211 AC4: the next waiting request opens.
    await expect(page.getByText("Assigned to Cody Coordinator.")).toBeVisible();
    await expect(page.getByRole("heading", { name: eventName })).toHaveCount(0);
    await page.goto("/queue");
    await expect(page.getByTestId("queue-row").filter({ hasText: eventName })).toHaveCount(0);

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
