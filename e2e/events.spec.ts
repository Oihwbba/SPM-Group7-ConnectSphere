import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";

/**
 * End-to-End (E2E) Test Suite for User Story 13: Create an Event Request.
 * Tests full browser interaction from user login, form section navigation, partial draft saving,
 * detail review, and final request submission.
 */
test.describe("User Story 13 — Event Request Creation Journey", () => {
  /**
   * TEST 1: Unblocked Step Navigation & Partial Draft Saving
   * Verifies that an organiser can freely navigate between form steps (e.g. Step 1 to Step 2)
   * without being blocked by unfilled mandatory fields, and can save a draft at any step.
   */
  test("organiser can navigate steps freely without mandatory fields and save partial draft", async ({
    page,
  }) => {
    // 1. Sign in as seeded event organiser
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("organiser@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();

    // 2. Wait to land on Organiser dashboard
    await page.waitForURL("**/events");

    const draftName = `Partial Draft ${Date.now()}`;

    // 3. Open the "Create Event Request" modal dialog
    await page.getByRole("button", { name: /Create Event Request/i }).first().click();

    // 4. Fill ONLY the event name in Step 1 (leave Purpose & Description empty)
    await page.getByLabel("Event Name *").fill(draftName);

    // 5. Click Next — verify user can proceed to Step 2 without mandatory field errors
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Schedule & Attendance/i })).toBeVisible();

    // 6. Click "Save as Draft" at Step 2
    await page.getByRole("button", { name: /Save as Draft/i }).click();

    // 7. Verify the partial draft event was created and appears in the organiser's events table
    await expect(page.getByRole("cell", { name: draftName })).toBeVisible();
  });

  /**
   * TEST 2: Complete Event Request Creation & Review Journey
   * Verifies that an organiser can fill all form sections (Basics, Schedule, Venue & Accessibility,
   * Equipment, Registration & Details), review entered details on Step 6, and submit for review.
   */
  test("organiser fills event request sections, reviews details, and submits request", async ({
    page,
  }) => {
    // 1. Sign in as seeded event organiser
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("organiser@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();

    // 2. Verify landing on "My Events" page
    await page.waitForURL("**/events");
    await expect(
      page.getByRole("heading", { name: "My Events" }),
    ).toBeVisible();

    const eventName = `E2E Tech Summit ${Date.now()}`;

    // 3. Open Creation Dialog
    await page.getByRole("button", { name: /Create Event Request/i }).first().click();

    // --- STEP 1: Basic Event Information ---
    await page.getByLabel("Event Name *").fill(eventName);
    await page.getByLabel("Event Purpose *").fill("To showcase regional innovations and foster cross-industry collaboration.");
    await page.getByLabel("Event Description *").fill("A comprehensive 2-day conference with keynotes, breakout tracks, and exhibition halls.");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // --- STEP 2: Proposed Schedule & Attendance ---
    const futureStartDate = "2027-10-15T09:00";
    const futureEndDate = "2027-10-16T18:00";
    await page.getByLabel("Proposed Start Date & Time *").fill(futureStartDate);
    await page.getByLabel("Proposed End Date & Time *").fill(futureEndDate);
    await page.getByLabel("Expected Attendance *").fill("250");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // --- STEP 3: Venue, Layout & Accessibility Requirements ---
    await page.getByLabel("Venue Requirements *").fill("Requires Grand Auditorium or large exhibition hall capacity with stage.");
    await page.getByLabel("Preferred Room Layout *").fill("Theatre");
    await page.getByLabel("Accessibility Needs *").fill("Wheelchair accessible ramps, designated accessible seating in front row, and accessible facility arrangements.");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // --- STEP 4: Equipment Requirements ---
    await page.getByLabel("Equipment & Technical Support Requirements *").fill("2 HD Projectors, 4 Wireless Lapel Microphones, Live Streaming Video Kit, Onsite Technical Support.");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // --- STEP 5: Registration & Additional Details ---
    await page.getByLabel("Registration Needs *").fill("Online registration enabled for 250 attendees with badge printing desk.");
    await page.getByLabel("Event Programme (Optional)").fill("Day 1: Keynotes & Panel; Day 2: Workshops & Closing Ceremony");
    await page.getByLabel("Special Requests / Arrangements (Optional)").fill("Catering for VIP speakers during lunch breaks.");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // --- STEP 6: Review Entered Details ---
    // Organiser reviews summary cards of all entered details before final submission
    await expect(page.getByRole("heading", { name: /Review Entered Details/i })).toBeVisible();
    await expect(page.getByText(eventName)).toBeVisible();
    await expect(page.getByText("Wheelchair accessible ramps")).toBeVisible();

    // 4. Click "Submit Request for Review"
    await page.getByRole("button", { name: /Submit Request for Review/i }).click();

    // 5. Verify the submitted event appears in the organiser's events table
    await expect(page.getByRole("cell", { name: eventName })).toBeVisible();
  });
});

/**
 * End-to-End (E2E) Test Suite for User Story 15: Save an Event Request as Draft.
 * Tests saving an incomplete draft, locating it on the events table, resuming editing with all fields preserved,
 * completing mandatory requirements, and submitting for review.
 */
test.describe("User Story 15 — Draft Event Request Lifecycle Journey", () => {
  test("organiser saves partial draft, locates and resumes draft with preserved fields, then completes and submits", async ({
    page,
  }) => {
    // 1. Sign in as seeded event organiser
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("organiser@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL("**/events");
    const draftName = `Draft To Resume ${Date.now()}`;

    // 2. Open dialog & fill partial fields (Step 1 Name & Step 2 Date/Time)
    await page.getByRole("button", { name: /Create Event Request/i }).first().click();
    await page.getByLabel("Event Name *").fill(draftName);
    await page.getByLabel("Event Purpose *").fill("Draft completion test purpose.");
    await page.getByLabel("Event Description *").fill("Detailed description for resumed draft.");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.getByLabel("Proposed Start Date & Time *").fill("2027-11-20T10:00");
    await page.getByLabel("Proposed End Date & Time *").fill("2027-11-20T18:00");

    // Save as draft at Step 2
    await page.getByRole("button", { name: /Save as Draft/i }).click();

    // 3. Locate draft row on table with "Resume Draft" button
    const row = page.getByRole("row", { name: draftName });
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: /Resume Draft/i })).toBeVisible();

    // 4. Click "Resume Draft" to reopen saved draft
    await row.getByRole("button", { name: /Resume Draft/i }).click();

    // 5. Verify modal opens in resume mode and retains previously entered fields (AC 2 & AC 3)
    await expect(page.getByRole("heading", { name: /Resume Draft Event Request/i })).toBeVisible();
    await expect(page.getByLabel("Event Name *")).toHaveValue(draftName);
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Verify Singapore wall-time round trip on resumed draft inputs
    await expect(page.getByLabel("Proposed Start Date & Time *")).toHaveValue("2027-11-20T10:00");
    await expect(page.getByLabel("Proposed End Date & Time *")).toHaveValue("2027-11-20T18:00");

    // 6. Complete missing fields across steps
    await page.getByLabel("Expected Attendance *").fill("100");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.getByLabel("Venue Requirements *").fill("Grand Hall");
    await page.getByLabel("Preferred Room Layout *").fill("Banquet");
    await page.getByLabel("Accessibility Needs *").fill("Wheelchair ramp");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.getByLabel("Equipment & Technical Support Requirements *").fill("Projector & Mic");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.getByLabel("Registration Needs *").fill("Online registration");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // 7. Review and Submit
    await expect(page.getByRole("heading", { name: /Review Entered Details/i })).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/Start:\s*20 Nov 2027, 10:00 am/i)).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/End:\s*20 Nov 2027, 6:00 pm/i)).toBeVisible();
    await page.getByRole("button", { name: /Submit Request for Review/i }).click();

    // 8. Verify event submitted successfully
    await expect(page.getByRole("cell", { name: draftName })).toBeVisible();
  });
});

/**
 * End-to-End (E2E) Test Suite for User Story 16: Distinguish Drafts from Submitted Requests.
 * Tests that draft requests are visually marked alongside submitted requests with distinct labels,
 * badges, styling, and filter tabs so they cannot be mistaken for submitted or under review requests.
 */
test.describe("User Story 16 — Distinguish Drafts from Submitted Requests Journey", () => {
  test("organiser can visually distinguish draft requests from submitted ones side-by-side and filter by status", async ({
    page,
  }) => {
    // 1. Sign in as seeded event organiser
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("organiser@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL("**/events");

    const draftTitle = `US16 Draft ${Date.now()}`;
    const submittedTitle = `US16 Submitted ${Date.now()}`;

    // 2. Create a Partial Draft Request
    await page.getByRole("button", { name: /Create Event Request/i }).first().click();
    await page.getByLabel("Event Name *").fill(draftTitle);
    await page.getByRole("button", { name: /Save as Draft/i }).click();

    // 3. Create and Submit a Complete Event Request
    await page.getByRole("button", { name: /Create Event Request/i }).first().click();
    await page.getByLabel("Event Name *").fill(submittedTitle);
    await page.getByLabel("Event Purpose *").fill("US16 visual distinguishability test purpose");
    await page.getByLabel("Event Description *").fill("US16 visual distinguishability test description");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.getByLabel("Proposed Start Date & Time *").fill("2027-12-01T09:00");
    await page.getByLabel("Proposed End Date & Time *").fill("2027-12-01T17:00");
    await page.getByLabel("Expected Attendance *").fill("80");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.getByLabel("Venue Requirements *").fill("Standard Seminar Room");
    await page.getByLabel("Preferred Room Layout *").fill("Classroom");
    await page.getByLabel("Accessibility Needs *").fill("Standard ramp access");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.getByLabel("Equipment & Technical Support Requirements *").fill("Microphone & Projector");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.getByLabel("Registration Needs *").fill("Standard check-in desk");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await expect(page.getByRole("heading", { name: /Review Entered Details/i })).toBeVisible();
    await page.getByRole("button", { name: /Submit Request for Review/i }).click();

    // 4. Verify Both Requests Appear on Table Side-by-Side with Distinct Visual Treatments
    const draftRow = page.getByRole("row", { name: new RegExp(draftTitle) });
    const submittedRow = page.getByRole("row", { name: new RegExp(submittedTitle) });

    await expect(draftRow).toBeVisible();
    await expect(submittedRow).toBeVisible();

    // 5. Verify Draft Row features visual "Draft — Incomplete" tag and "Resume Draft" button (AC 1 & AC 2)
    await expect(draftRow.getByTestId("draft-label")).toBeVisible();
    await expect(draftRow.getByText("Draft — Incomplete")).toBeVisible();
    await expect(draftRow.getByTestId("resume-draft-button")).toBeVisible();

    // 6. Verify Submitted Row features "View Details" button and info badge (not confused with draft)
    await expect(submittedRow.getByTestId("view-details-button")).toBeVisible();

    // 7. Verify Filter Tabs (Filter by Drafts and Submitted)
    await page.getByRole("button", { name: /Drafts/i }).click();
    await expect(page.getByRole("cell", { name: draftTitle })).toBeVisible();
    await expect(page.getByRole("cell", { name: submittedTitle })).not.toBeVisible();

    await page.getByRole("button", { name: /Submitted/i }).click();
    await expect(page.getByRole("cell", { name: submittedTitle })).toBeVisible();
    await expect(page.getByRole("cell", { name: draftTitle })).not.toBeVisible();

    await page.getByRole("button", { name: /All Requests/i }).click();
    await expect(page.getByRole("cell", { name: draftTitle })).toBeVisible();
    await expect(page.getByRole("cell", { name: submittedTitle })).toBeVisible();
  });
});

/**
 * End-to-End (E2E) Test Suite for User Story 84: Organiser Views Their Own Event Requests.
 * Tests that an organiser sees all their created event requests regardless of status,
 * each entry shows event name and status badge, ownership rules are strictly enforced across organisers,
 * and selecting any entry opens the full event details.
 */
test.describe("User Story 84 — Organiser Views Their Own Event Requests Journey", () => {
  test("organiser views list of their own events with names, status badges, and selects an entry for full detail", async ({
    page,
  }) => {
    // 1. Sign in as seeded event organiser
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("organiser@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL("**/events");
    await expect(page.getByRole("heading", { name: "My Events" })).toBeVisible();

    const eventTitle = `US84 Event ${Date.now()}`;

    // 2. Create a Draft Event Request
    await page.getByRole("button", { name: /Create Event Request/i }).first().click();
    await page.getByLabel("Event Name *").fill(eventTitle);
    await page.getByRole("button", { name: /Save as Draft/i }).click();

    // 3. Assert event row is displayed with Name and Status Badge (AC 1 & AC 2)
    const row = page.getByRole("row", { name: new RegExp(eventTitle) });
    await expect(row).toBeVisible();
    await expect(row.getByTestId("status-badge")).toBeVisible();
    await expect(row.getByTestId("status-badge")).toHaveAttribute("data-status", "DRAFT");

    // 4. Select entry (Clicking Event Name Link) opens Full Detail Modal (AC 5)
    await row.getByTestId("event-name-link").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: eventTitle })).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/Draft Event Request/i)).toBeVisible();

    // Close detail modal
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).first().click();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // 5. Select entry via "View Details" button also opens Full Detail Modal (AC 5)
    await row.getByTestId("view-details-button").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: eventTitle })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).first().click();
  });

  test("enforces ownership isolation: organiser2 sees only their own events (AC 3)", async ({
    page,
  }) => {
    // 1. Sign in as organiser2 (owns evt_other_organiser per seed data)
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("organiser2@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL("**/events");
    await expect(page.getByRole("heading", { name: "My Events" })).toBeVisible();

    // 2. Organiser 2 sees their own seeded event (evt_other_organiser: "Another Client's Event — Product Launch")
    await expect(page.getByText("Another Client's Event — Product Launch")).toBeVisible();

    // 3. Organiser 2 does NOT see events belonging to organiser@test.local (e.g. "Draft — Annual Tech Summit")
    await expect(page.getByText("Draft — Annual Tech Summit")).not.toBeVisible();
  });
});

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

test.describe("User Story 23 & 24 — Event Status View & Consistency Journey", () => {
  test.beforeEach(async () => {
    if (!usesLocalDatabase) return;
    // Reset both events used by tests so CI retries stay green
    await prisma.event.updateMany({
      where: { id: "evt_submitted" },
      data: {
        status: "SUBMITTED",
        decisionReason: null,
        decidedAt: null,
        decidedById: null,
      },
    });
    await prisma.event.updateMany({
      where: { id: "evt_under_review" },
      data: {
        status: "UNDER_REVIEW",
        decisionReason: null,
        decidedAt: null,
        decidedById: null,
      },
    });
  });

  test("coordinator views assigned event status and status remains consistent across views (SCRUM-23 & SCRUM-24)", async ({
    page,
  }) => {
    // 1. Sign in as Event Coordinator
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("coordinator@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();

    // 2. Navigate to Coordinator Event Requests dashboard
    await page.waitForURL("**/events");
    await expect(page.getByRole("heading", { name: "Event Requests" })).toBeVisible();

    // 3. Verify status badge consistency on list view and detail modal for an assigned event
    const underReviewRow = page.getByRole("row", { name: /Under Review — Career Fair/i });
    await expect(underReviewRow).toBeVisible();
    await expect(underReviewRow.getByTestId("status-badge")).toHaveAttribute("data-status", "UNDER_REVIEW");

    // Open detail modal and verify same status badge
    await underReviewRow.getByRole("button", { name: /View Details|Details/i }).click();
    const detailModal = page.getByRole("dialog");
    await expect(detailModal).toBeVisible();
    await expect(detailModal.getByTestId("status-badge")).toHaveAttribute("data-status", "UNDER_REVIEW");
    await page.keyboard.press("Escape");

    // 4. Test status transition & decision validation: Reject a submitted event request
    const submittedRow = page.getByRole("row", { name: /Submitted — Alumni Homecoming/i });
    await expect(submittedRow).toBeVisible();
    await expect(submittedRow.getByTestId("status-badge")).toHaveAttribute("data-status", "SUBMITTED");

    // Click Reject button
    await submittedRow.getByRole("button", { name: /Reject/i }).click();
    const rejectModal = page.getByRole("dialog", { name: /Reject event request/i });
    await expect(rejectModal).toBeVisible();

    // Blank reason must keep submit button disabled (refused path)
    const submitRejectBtn = rejectModal.getByRole("button", { name: "Reject request" });
    await expect(submitRejectBtn).toBeDisabled();

    // Provide clear rejection reason and submit decision
    await page.getByPlaceholder("Reason for rejection").fill("Insufficient venue capacity for requested date");
    await expect(submitRejectBtn).toBeEnabled();
    await submitRejectBtn.click();

    // 5. Verify updated status is consistent across list and detail views
    await expect(submittedRow.getByTestId("status-badge")).toHaveAttribute("data-status", "REJECTED");
    await submittedRow.getByRole("button", { name: /View Details|Details/i }).click();
    await expect(detailModal).toBeVisible();
    await expect(detailModal.getByTestId("status-badge")).toHaveAttribute("data-status", "REJECTED");
  });

  test("coordinator approves an under-review event and status flips to APPROVED (SCRUM-24)", async ({
    page,
  }) => {
    // 1. Sign in as Event Coordinator
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("coordinator@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();

    // 2. Navigate to Coordinator Event Requests dashboard
    await page.waitForURL("**/events");
    await expect(page.getByRole("heading", { name: "Event Requests" })).toBeVisible();

    // 3. Locate the Under Review event and verify its current status
    const underReviewRow = page.getByRole("row", { name: /Under Review — Career Fair/i });
    await expect(underReviewRow).toBeVisible();
    await expect(underReviewRow.getByTestId("status-badge")).toHaveAttribute("data-status", "UNDER_REVIEW");

    // 4. Click Approve and verify the badge flips in the row
    await underReviewRow.getByRole("button", { name: /Approve/i }).click();
    await expect(underReviewRow.getByTestId("status-badge")).toHaveAttribute("data-status", "APPROVED");

    // 5. Open detail modal and verify the same APPROVED status
    await underReviewRow.getByRole("button", { name: /View Details|Details/i }).click();
    const detailModal = page.getByRole("dialog");
    await expect(detailModal).toBeVisible();
    await expect(detailModal.getByTestId("status-badge")).toHaveAttribute("data-status", "APPROVED");
  });
});

/**
 * SCRUM-19 — the user-visible halves of "reject with a reason" and "amend and
 * resubmit". The event is created straight in the database so this journey
 * does not depend on (or disturb) the seeded events the tests above reset.
 */
test.describe("SCRUM-19 — Reject with a reason, then amend and resubmit", () => {
  test.skip(!usesLocalDatabase, "writes its own event; local database only");

  let eventId: string;
  let eventName: string;

  async function signIn(page: Page, email: string) {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/events");
  }

  test.beforeEach(async () => {
    eventName = `SCRUM-19 Reject And Amend ${Date.now()}`;
    const event = await prisma.event.create({
      data: {
        name: eventName,
        purpose: "Reject and amend journey",
        description: "Owned by the SCRUM-19 e2e spec.",
        status: "UNDER_REVIEW",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        startAt: new Date("2031-06-01T02:00:00Z"),
        endAt: new Date("2031-06-01T10:00:00Z"),
        expectedAttendance: 60,
        venueRequirements: "Any room",
        requiredFacilities: [],
        accessibilityNeeds: "None",
        preferredLayout: "Classroom",
        equipmentRequirements: "None",
        registrationNotes: "None",
        submittedAt: new Date(),
      },
      select: { id: true },
    });
    eventId = event.id;
  });

  test.afterEach(async () => {
    await prisma.notification.deleteMany({ where: { eventId } });
    await prisma.auditLog.deleteMany({ where: { entityId: eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
  });

  test("coordinator rejects with a reason, organiser sees it, amends and resubmits it back into review", async ({
    page,
  }) => {
    const reason = "Venue is unavailable on that date — please propose another.";

    // --- Coordinator rejects, and a blank reason is refused ---------------
    await signIn(page, "coordinator@test.local");
    const coordinatorRow = page.getByRole("row", { name: new RegExp(eventName) });
    await coordinatorRow.getByRole("button", { name: /Reject/i }).click();

    const rejectDialog = page.getByRole("dialog", { name: /Reject event request/i });
    const rejectButton = rejectDialog.getByRole("button", { name: "Reject request" });
    await expect(rejectButton).toBeDisabled();
    await rejectDialog.getByLabel("Rejection reason").fill("   ");
    await expect(rejectButton).toBeDisabled();

    await rejectDialog.getByLabel("Rejection reason").fill(reason);
    await expect(rejectButton).toBeEnabled();
    await rejectButton.click();
    await expect(coordinatorRow.getByTestId("status-badge")).toHaveAttribute(
      "data-status",
      "REJECTED",
    );

    // --- Organiser sees the REJECTED badge and the reason -----------------
    await signIn(page, "organiser@test.local");
    const organiserRow = page.getByRole("row", { name: new RegExp(eventName) });
    await expect(organiserRow.getByTestId("status-badge")).toHaveAttribute(
      "data-status",
      "REJECTED",
    );
    await organiserRow.getByTestId("view-details-button").click();
    const details = page.getByRole("dialog");
    await expect(details.getByText("Rejection reason")).toBeVisible();
    await expect(details.getByText(reason)).toBeVisible();
    await page.keyboard.press("Escape");

    // --- Organiser amends and resubmits -----------------------------------
    await organiserRow.getByTestId("amend-rejected-button").click();
    await expect(
      page.getByRole("heading", { name: /Amend Rejected Event Request/i }),
    ).toBeVisible();

    // The form comes back pre-filled from the rejected request; amend one
    // field (venue requirements, step 3), then walk on to the review step.
    const next = page.getByRole("button", { name: "Next", exact: true });
    await next.click();
    await next.click();
    await page.getByLabel("Venue Requirements *").fill("Any room — a different date is fine.");
    for (let i = 0; i < 3; i++) {
      await next.click();
    }
    await expect(page.getByRole("heading", { name: /Review Entered Details/i })).toBeVisible();
    await page.getByRole("button", { name: /Submit Request for Review/i }).click();
    await expect(
      page.getByText("Event request submitted for review successfully!"),
    ).toBeVisible();

    // It is back in review, and the old decision no longer shows.
    await expect(organiserRow.getByTestId("status-badge")).toHaveAttribute(
      "data-status",
      /^(SUBMITTED|UNDER_REVIEW)$/,
    );
    await organiserRow.getByTestId("view-details-button").click();
    await expect(page.getByRole("dialog").getByText("Rejection reason")).toHaveCount(0);
  });
});
