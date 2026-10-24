import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/db";
import { pickDateTime, selectFrom, fillOther, saveDraft, submitRequest } from "./helpers";

/**
 * End-to-End (E2E) Test Suite for User Story 13: Create an Event Request.
 * Tests full browser interaction from user login, form section navigation, partial draft saving,
 * detail review, and final request submission.
 */
test.describe("User Story 13 — Event Request Creation Journey", () => {
  // Every step is filled through the app's pickers and dropdowns, which take
  // more clicks than typing did; the whole journey needs more than 30 seconds.
  test.describe.configure({ timeout: 90_000 });
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
    await saveDraft(page);

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
    await pickDateTime(page.getByLabel("Proposed Start Date & Time *"), futureStartDate);
    await pickDateTime(page.getByLabel("Proposed End Date & Time *"), futureEndDate);
    await page.getByLabel("Expected Attendance *").fill("250");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // --- STEP 3: Venue, Layout & Accessibility Requirements ---
    await fillOther(page.getByLabel("Venue Requirements *"), "Requires Grand Auditorium or large exhibition hall capacity with stage.");
    await fillOther(page.getByLabel("Preferred Room Layout *"), "Theatre");
    await fillOther(page.getByLabel("Accessibility Needs *"), "Wheelchair accessible ramps, designated accessible seating in front row, and accessible facility arrangements.");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // --- STEP 4: Equipment Requirements ---
    await fillOther(page.getByLabel("Equipment & Technical Support Requirements *"), "2 HD Projectors, 4 Wireless Lapel Microphones, Live Streaming Video Kit, Onsite Technical Support.");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // --- STEP 5: Registration & Additional Details ---
    // SCRUM-171 AC1: Registration needed is required to submit; the note is optional.
    await page.getByRole("group", { name: "Registration Needed *" }).getByLabel("Yes").check();
    await page.getByLabel("Registration Notes (Optional)").fill("Online registration enabled for 250 attendees with badge printing desk.");
    await page.getByLabel("Event Programme (Optional)").fill("Day 1: Keynotes & Panel; Day 2: Workshops & Closing Ceremony");
    await page.getByLabel("Special Requests / Arrangements (Optional)").fill("Catering for VIP speakers during lunch breaks.");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // --- STEP 6: Review Entered Details ---
    // Organiser reviews summary cards of all entered details before final submission
    await expect(page.getByRole("heading", { name: /Review Entered Details/i })).toBeVisible();
    await expect(page.getByText(eventName)).toBeVisible();
    await expect(page.getByText("Wheelchair accessible ramps")).toBeVisible();

    // 4. Click "Submit Request for Review"
    await submitRequest(page);

    // 5. Verify the submitted event appears in the organiser's events table
    await expect(page.getByRole("cell", { name: eventName })).toBeVisible();
  });

  /**
   * TEST 3: SCRUM-13 [AC4] / SCRUM-14 AC2 — Submission is blocked when mandatory fields are missing.
   * Step navigation is not blocked by missing values, so this test reaches Review
   * with empty inputs and verifies submit is rejected with field-level feedback.
   */
  test("SCRUM-13 [AC4] / SCRUM-14 AC2: submitting with mandatory fields left blank is refused and missing fields are indicated", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("organiser@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/events");

    await page.getByRole("button", { name: /Create Event Request/i }).first().click();

    // Walk every step with nothing entered — Next never blocks on missing
    // mandatory fields (see TEST 1), only on invalid values.
    for (let i = 0; i < 5; i++) {
      await page.getByRole("button", { name: "Next", exact: true }).click();
    }

    // Review already indicates the request is incomplete before submit.
    await expect(page.getByRole("heading", { name: /Review Entered Details/i })).toBeVisible();
    await expect(
      page.getByText(/complete all required fields highlighted in red/i),
    ).toBeVisible();

    // Submit is server-gated; it must fail and keep the dialog open.
    await page.getByRole("button", { name: /Submit Request for Review/i }).click();
    await expect(
      page.getByText("Please fix the highlighted fields before submitting."),
    ).toBeVisible();

    await page.getByRole("button", { name: "1 - Basics" }).click();
    await expect(page.getByLabel("Event Name *")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Event name is required.")).toBeVisible();
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

    await pickDateTime(page.getByLabel("Proposed Start Date & Time *"), "2027-11-20T10:00");
    await pickDateTime(page.getByLabel("Proposed End Date & Time *"), "2027-11-20T18:00");

    // Save as draft at Step 2
    await saveDraft(page);

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
    await expect(page.getByLabel("Proposed Start Date & Time *")).toHaveAttribute("data-value", "2027-11-20T10:00");
    await expect(page.getByLabel("Proposed End Date & Time *")).toHaveAttribute("data-value", "2027-11-20T18:00");

    // 6. Complete missing fields across steps
    await page.getByLabel("Expected Attendance *").fill("100");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await fillOther(page.getByLabel("Venue Requirements *"), "Grand Hall");
    await fillOther(page.getByLabel("Preferred Room Layout *"), "Banquet");
    await fillOther(page.getByLabel("Accessibility Needs *"), "Wheelchair ramp");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await fillOther(page.getByLabel("Equipment & Technical Support Requirements *"), "Projector & Mic");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // SCRUM-171 AC1: Registration needed is required to submit; the note is optional.
    await page.getByRole("group", { name: "Registration Needed *" }).getByLabel("Yes").check();
    await page.getByLabel("Registration Notes (Optional)").fill("Online registration");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // 7. Review and Submit
    await expect(page.getByRole("heading", { name: /Review Entered Details/i })).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/Start:\s*20 Nov 2027, 10:00 am SGT/i)).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/End:\s*20 Nov 2027, 6:00 pm SGT/i)).toBeVisible();
    await submitRequest(page);

    // 8. Verify event submitted successfully
    await expect(page.getByRole("cell", { name: draftName })).toBeVisible();
  });

  /**
   * TEST 2: SCRUM-15 [AC2, AC7 - Draft Save Idempotency] — Saving the same draft twice updates the record.
   * Verifies that reopening a saved draft and clicking "Save as Draft" again
   * updates the existing row in-place rather than creating a duplicate row.
   */
  test("SCRUM-15 [AC2, AC7 - Draft Save Idempotency]: saving an existing draft a second time updates the record in-place without creating duplicate rows", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("organiser@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/events");

    const draftName = `Idempotent Draft ${Date.now()}`;

    // 1. Create the initial draft.
    await page.getByRole("button", { name: /Create Event Request/i }).first().click();
    await page.getByLabel("Event Name *").fill(draftName);
    await saveDraft(page);

    // Exactly one row must exist.
    const initialRows = page.getByRole("row", { name: new RegExp(draftName) });
    await expect(initialRows).toHaveCount(1);

    // 2. Reopen the same draft and save again with an updated name.
    await initialRows.getByRole("button", { name: /Resume Draft/i }).click();
    const updatedName = `${draftName} — Updated`;
    await page.getByLabel("Event Name *").fill(updatedName);
    await saveDraft(page);

    // 3. Exactly one row total contains the draft substring (draftName is a substring of updatedName).
    // If a bug created a duplicate row instead of updating, there would be two rows matching draftName (one old, one new).
    await expect(
      page.getByRole("row", { name: new RegExp(draftName) }),
    ).toHaveCount(1);

    // Assert that the updated draft name is visible in the row.
    await expect(
      page.getByRole("cell", { name: updatedName }),
    ).toBeVisible();
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
    await saveDraft(page);

    // 3. Create and Submit a Complete Event Request
    await page.getByRole("button", { name: /Create Event Request/i }).first().click();
    await page.getByLabel("Event Name *").fill(submittedTitle);
    await page.getByLabel("Event Purpose *").fill("US16 visual distinguishability test purpose");
    await page.getByLabel("Event Description *").fill("US16 visual distinguishability test description");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await pickDateTime(page.getByLabel("Proposed Start Date & Time *"), "2027-12-01T09:00");
    await pickDateTime(page.getByLabel("Proposed End Date & Time *"), "2027-12-01T17:00");
    await page.getByLabel("Expected Attendance *").fill("80");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await fillOther(page.getByLabel("Venue Requirements *"), "Standard Seminar Room");
    await fillOther(page.getByLabel("Preferred Room Layout *"), "Classroom");
    await fillOther(page.getByLabel("Accessibility Needs *"), "Standard ramp access");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await fillOther(page.getByLabel("Equipment & Technical Support Requirements *"), "Microphone & Projector");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // SCRUM-171 AC1: Registration needed is required to submit; the note is optional.
    await page.getByRole("group", { name: "Registration Needed *" }).getByLabel("Yes").check();
    await page.getByLabel("Registration Notes (Optional)").fill("Standard check-in desk");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await expect(page.getByRole("heading", { name: /Review Entered Details/i })).toBeVisible();
    await submitRequest(page);

    // 4. Verify Both Requests Appear on Table Side-by-Side with Distinct Visual Treatments
    const draftRow = page.getByRole("row", { name: new RegExp(draftTitle) });
    const submittedRow = page.getByRole("row", { name: new RegExp(submittedTitle) });

    await expect(draftRow).toBeVisible();
    await expect(submittedRow).toBeVisible();

    // 5. Verify the Draft row's Draft badge and "Resume Draft" button (AC 1 & AC 2).
    // The status badge is the one Draft marker (shared page conventions,
    // change 3: no second "Draft — Incomplete" tag).
    await expect(draftRow.getByTestId("status-badge")).toHaveAttribute("data-status", "DRAFT");
    await expect(draftRow.getByText("Draft — Incomplete")).toHaveCount(0);
    await expect(draftRow.getByTestId("resume-draft-button")).toBeVisible();

    // 6. Verify Submitted Row features "View Details" button and info badge (not confused with draft)
    await expect(submittedRow.getByTestId("view-details-button")).toBeVisible();

    // 6b (SCRUM-14 AC4): once submitted, the request can no longer be edited
    // as a draft — neither "Resume Draft" nor "Amend & Resubmit" is offered
    // for a SUBMITTED row (those only apply to DRAFT and REJECTED respectively).
    await expect(submittedRow.getByTestId("resume-draft-button")).toHaveCount(0);
    await expect(submittedRow.getByTestId("amend-rejected-button")).toHaveCount(0);

    // 7. Verify Filter Tabs (Filter by Drafts and Submitted)
    await page.getByRole("button", { name: /Drafts/i }).click();
    await expect(page.getByRole("cell", { name: draftTitle })).toBeVisible();
    await expect(page.getByRole("cell", { name: submittedTitle })).not.toBeVisible();

    // SCRUM-131 AC1: the tab of every non-draft request is named Sent.
    await page.getByRole("button", { name: /^Sent \(/ }).click();
    await expect(page.getByRole("cell", { name: submittedTitle })).toBeVisible();
    await expect(page.getByRole("cell", { name: draftTitle })).not.toBeVisible();

    await page.getByRole("button", { name: /^All \(/i }).click();
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
    await saveDraft(page);

    // 3. Assert event row is displayed with Name and Status Badge (AC 1 & AC 2)
    const row = page.getByRole("row", { name: new RegExp(eventTitle) });
    await expect(row).toBeVisible();
    await expect(row.getByTestId("status-badge")).toBeVisible();
    await expect(row.getByTestId("status-badge")).toHaveAttribute("data-status", "DRAFT");

    // 4. Selecting the entry by its name opens its page (AC 5, SCRUM-208 AC1)
    await row.getByTestId("event-name-link").click();
    await expect(page).toHaveURL(/\/events\/[^/?]+$/);
    await expect(page.getByRole("heading", { level: 1, name: eventTitle })).toBeVisible();
    await expect(page.getByTestId("next-step")).toContainText(
      "Your turn: finish the request and submit it for review",
    );

    // Back to the list
    await page.getByRole("link", { name: "Back to My Events" }).click();
    await expect(page).toHaveURL(/\/events$/);

    // 5. "View Details" opens the same page (AC 5)
    await row.getByTestId("view-details-button").click();
    await expect(page.getByRole("heading", { level: 1, name: eventTitle })).toBeVisible();
  });

  test("SCRUM-84 [AC1 - Ownership Data Isolation]: enforces ownership isolation: organiser2 sees only their own events", async ({
    page,
  }) => {
    // 1. Sign in as organiser2 (owns evt_other_organiser per seed data)
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("organiser2@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL("**/events");
    await expect(page.getByRole("heading", { name: "My Events" })).toBeVisible();

    // 2. Organiser 2 sees their own seeded event (evt_other_organiser: "Another Client's Event — Product Launch").
    await expect(
      page.getByText("Another Client's Event — Product Launch"),
    ).toBeVisible();

    // 3. Organiser 2 does NOT see events belonging to organiser@test.local
    //    ANYWHERE on the page (not just inside the table): a whole-page check so
    //    a leak into any other region would fail the test too.
    await expect(
      page.getByText("Draft — Annual Tech Summit"),
    ).not.toBeVisible();
  });
});

/**
 * Mobile presentation (SCRUM-66 / SCRUM-68) — at a phone viewport the single
 * events table (events-client.tsx + events-list.module.css) restyles each row
 * into a stacked card: there is ONE presentation in the DOM, so the actions use
 * their plain testids (no "mobile-" prefix). This pins the responsive restyle
 * and that the card actions still work.
 */
test.describe("User Story 84 — Events list on mobile (375x812)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("restyles rows as stacked cards with no page overflow, and Resume Draft opens the dialog", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("organiser@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/events");
    await expect(page.getByRole("heading", { name: "My Events" })).toBeVisible();

    // Each row is laid out as a stacked card (CSS grid), not an aligned table
    // row — this is the responsive restyle, on the same single element.
    const rowDisplay = await page
      .locator("tbody tr")
      .first()
      .evaluate((el) => getComputedStyle(el).display);
    expect(rowDisplay).toBe("grid");

    // The card's actions render exactly once, under their plain testids.
    await expect(
      page.getByTestId("view-details-button").first(),
    ).toBeVisible();

    // The field labels the hidden column header dropped are real, visible text
    // on the card (not CSS ::before) so screen readers announce them. Scoped to
    // the cell's label span, since the (hidden) column header also reads "Starts".
    const startsLabel = page.locator('td[data-col="starts"] span').first();
    await expect(startsLabel).toBeVisible();
    await expect(startsLabel).toHaveText("Starts");
    const createdLabel = page.locator('td[data-col="created"] span').first();
    await expect(createdLabel).toBeVisible();
    await expect(createdLabel).toHaveText("Last Updated");

    // A draft card keeps its accent: the 4px muted left border only renders
    // when the row's data-status="DRAFT" drives the CSS, so this guards against
    // the accent silently dying.
    const draftBorderLeft = await page
      .getByTestId("draft-event-row")
      .first()
      .evaluate((el) => getComputedStyle(el).borderLeftWidth);
    expect(draftBorderLeft).toBe("4px");

    // No horizontal page overflow at 375px.
    const overflowsX = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflowsX).toBe(false);

    // Tapping a draft card's Resume Draft opens the resume dialog. The seeded
    // "Draft — Annual Tech Summit" guarantees at least one draft card exists.
    await page.getByTestId("resume-draft-button").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Resume Draft Event Request/i }),
    ).toBeVisible();
  });

  // SCRUM-18/19 — the coordinator's review actions and the clarification
  // dialog. Two things broke on a real phone and are pinned here: the four
  // review buttons wrapped unevenly (Reject alone on a second line), and the
  // dialog's stacked footer buttons touched.
  test("SCRUM-18/19: the four review buttons form an even two-column grid and stacked dialog buttons are separated", async ({
    page,
  }) => {
    // Read at run time: the const is declared further down this file.
    test.skip(!usesLocalDatabase, "writes its own event; local database only");

    const eventName = `SCRUM-18 Mobile Layout ${Date.now()}`;
    const event = await prisma.event.create({
      data: {
        name: eventName,
        status: "UNDER_REVIEW",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        startAt: new Date("2031-06-01T02:00:00Z"),
        endAt: new Date("2031-06-01T10:00:00Z"),
      },
      select: { id: true },
    });

    try {
      await page.goto("/login");
      await page.getByLabel("Email", { exact: true }).fill("coordinator@test.local");
      await page.getByLabel("Password", { exact: true }).fill("Password123!");
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL("**/events");

      // On a phone the row is a card (display: grid), so it is found by its
      // data-status attribute rather than the table "row" role.
      const card = page.locator("tr[data-status]", { hasText: eventName });
      await expect(card).toBeVisible();

      const view = card.getByTestId("view-details-button");
      const approve = card.getByRole("button", { name: "Approve" });
      const ask = card.getByRole("button", { name: "Ask" });
      const reject = card.getByRole("button", { name: "Reject", exact: true });

      const boxes = [];
      for (const button of [view, approve, ask, reject]) {
        await expect(button).toBeVisible();
        boxes.push((await button.boundingBox())!);
      }
      const [viewBox, approveBox, askBox, rejectBox] = boxes;

      // Two columns of equal width, two per row, in the order View, Ask,
      // Approve, Reject (shared page conventions): Reject sits beside Approve
      // instead of wrapping onto a line of its own.
      for (const box of boxes) {
        expect(Math.abs(box.width - viewBox.width)).toBeLessThanOrEqual(1);
      }
      expect(Math.abs(viewBox.y - askBox.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(approveBox.y - rejectBox.y)).toBeLessThanOrEqual(1);
      expect(approveBox.y).toBeGreaterThan(viewBox.y);

      // Nothing pushes the page wider than the phone.
      const overflowsX = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(overflowsX).toBe(false);

      // The dialog's stacked footer buttons must not touch.
      await ask.click();
      const dialog = page.getByRole("dialog", { name: /Request clarification/i });
      await expect(dialog).toBeVisible();
      // The dialog animates in, so wait for it to settle and read both buttons
      // in one call: separate boundingBox() calls sample different frames of
      // the slide and can report a negative gap on a correct layout.
      await dialog.evaluate((el) =>
        Promise.all(el.getAnimations().map((animation) => animation.finished)),
      );
      const gap = await dialog.evaluate((el) => {
        const rectOf = (label: string) =>
          [...el.querySelectorAll("button")]
            .find((button) => button.textContent?.trim() === label)!
            .getBoundingClientRect();
        return rectOf("Cancel").top - rectOf("Send request").bottom;
      });
      expect(gap).toBeGreaterThanOrEqual(6);
    } finally {
      await prisma.notification.deleteMany({ where: { eventId: event.id } });
      await prisma.auditLog.deleteMany({ where: { entityId: event.id } });
      await prisma.event.deleteMany({ where: { id: event.id } });
    }
  });
});

/**
 * Desktop list controls and dialog behaviour (SCRUM-129 Singapore time, SCRUM-13 AC6
 * unsaved-changes guard, SCRUM-84 AC7-AC9 sorting/filtering). These need the
 * default viewport: below md the table restyles into cards and the column
 * headers the sort test clicks are hidden.
 */
test.describe("User Story 129, 13 & 84 — Singapore time, unsaved changes and list controls", () => {
  test("SCRUM-129 [AC1 - Singapore timezone]: the request form has no timezone selector and states its times are SGT", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("organiser@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/events");

    await page.getByRole("button", { name: /Create Event Request/i }).first().click();
    await page.getByLabel("Event Name *").fill(`SGT Event ${Date.now()}`);
    await page.getByRole("button", { name: "Next", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("All times are Singapore time (SGT, UTC+8).")).toBeVisible();
    await expect(dialog.getByLabel(/timezone/i)).toHaveCount(0);

    // SCRUM-129 AC3: the review step labels the entered times SGT.
    await pickDateTime(page.getByLabel("Proposed Start Date & Time *"), "2031-11-20T10:00");
    await pickDateTime(page.getByLabel("Proposed End Date & Time *"), "2031-11-20T18:00");
    await page.getByRole("button", { name: "6 - Review" }).click();
    await expect(dialog.getByText(/Start:\s*20 Nov 2031, 10:00 am SGT/)).toBeVisible();
    await expect(dialog.getByText(/End:\s*20 Nov 2031, 6:00 pm SGT/)).toBeVisible();
    await expect(dialog.getByText(/Timezone:/)).toHaveCount(0);
  });

  test("SCRUM-15 [AC6 - Unsaved Changes Warning]: unsaved changes warning appears when closing an edited draft dialog", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("organiser@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/events");

    const draftTitle = `Unsaved Work Draft ${Date.now()}`;
    await page.getByRole("button", { name: /Create Event Request/i }).first().click();
    await page.getByLabel("Event Name *").fill(draftTitle);

    // Click backdrop/close button to trigger dirty form exit warning
    await page.keyboard.press("Escape");

    // 1. Verify warning dialog appears
    const confirmDialog = page.getByRole("dialog", { name: /Unsaved Changes/i });
    await expect(confirmDialog).toBeVisible();
    await expect(page.getByText(/You have unsaved changes in this event request/i)).toBeVisible();

    // 2. Click "Continue Editing" — keeps the creation dialog open with typed name intact
    await confirmDialog.getByRole("button", { name: /Continue Editing/i }).click();
    await expect(confirmDialog).not.toBeVisible();
    await expect(page.getByRole("dialog", { name: /Create Event Request/i })).toBeVisible();
    await expect(page.getByLabel("Event Name *")).toHaveValue(draftTitle);

    // 3. Trigger exit warning again and click "Discard Changes" — closes dialog without saving draft
    await page.keyboard.press("Escape");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: /Discard Changes/i }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("cell", { name: draftTitle })).not.toBeVisible();
  });

  test("SCRUM-84 AC7-AC9: organiser sorts columns and filters list by status dropdown and search", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("organiser@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/events");

    // Column Header Sort Toggle test - sort by Name ascending
    const nameHeader = page.getByRole("columnheader", { name: /Name/i });
    await expect(nameHeader).toBeVisible();
    await page.getByRole("button", { name: "Sort by Name" }).click();
    await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");

    // Verify actual row ordering after sorting by Name
    const firstRowName = await page.getByTestId("event-name-link").first().textContent();
    const secondRowName = await page.getByTestId("event-name-link").nth(1).textContent();
    if (firstRowName && secondRowName) {
      expect(firstRowName.localeCompare(secondRowName)).toBeLessThanOrEqual(0);
    }

    // Status Select Filter test - select DRAFT and assert draft row is visible while SUBMITTED rows are excluded
    await selectFrom(page.getByLabel("Filter by status"), "DRAFT");
    await expect(page.getByLabel("Filter by status")).toHaveText("Draft");
    await expect(page.getByTestId("draft-event-row").first()).toBeVisible();
    await expect(page.locator('[data-status="SUBMITTED"]')).not.toBeVisible();

    // Search query test - search for matching event and assert non-matching events are excluded
    await page.getByPlaceholder("Search by name or purpose...").fill("Annual");
    await expect(page.getByPlaceholder("Search by name or purpose...")).toHaveValue("Annual");
    await expect(page.getByText("Annual Tech Summit")).toBeVisible();
    await expect(page.getByText("Career Fair")).not.toBeVisible();
  });

  test("SCRUM-13 [AC9]: entering a past start date on Step 2 blocks navigation to Step 3 and shows an inline error", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("organiser@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/events");

    await page.getByRole("button", { name: /Create Event Request/i }).first().click();
    await page.getByLabel("Event Name *").fill("Past Date Validation Test");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // AC9: enter a start date clearly in the past.
    await pickDateTime(page.getByLabel("Proposed Start Date & Time *"), "2020-01-01T10:00");
    await pickDateTime(page.getByLabel("Proposed End Date & Time *"), "2020-01-01T12:00");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // The step validator should reject the past date and display an inline error.
    await expect(
      page.getByText("Proposed date cannot be in the past."),
    ).toBeVisible();

    // The dialog must NOT have advanced beyond Step 2 (Schedule heading is still visible).
    await expect(
      page.getByRole("heading", { name: /Schedule.*Attendance/i }),
    ).toBeVisible();
  });

  test("SCRUM-84 [AC6/AC9 - Filtered Empty State & Clear Filters]: filtered empty state shows 'No requests match' card with a Clear Filters CTA when search yields no results", async ({
    page,
  }) => {
    // AC6 & AC9 cover status filtering, search queries, and search cleared behavior.
    // We test the filtered empty state (a search term with no results) which exercises
    // the search filtering logic and the Clear Filters restoration path.
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("organiser2@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/events");

    // organiser2 has at least one event; a nonsense search term returns nothing.
    const searchInput = page.getByPlaceholder("Search by name or purpose...");
    await searchInput.fill("xyznonexistent99999");

    // AC5: the empty-state card and the Clear Filters action must appear.
    await expect(
      page.getByText("No requests match the selected filters."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Clear Filters" }),
    ).toBeVisible();

    // Clicking Clear Filters resets the view and restores the event list.
    await page.getByRole("button", { name: "Clear Filters" }).click();
    await expect(searchInput).toHaveValue("");
    await expect(
      page.getByText("Another Client's Event"),
    ).toBeVisible();
  });
});

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

test.describe("User Story 23 & 24 — Event Status View & Consistency Journey", () => {
  test.afterAll(async () => {
    if (!usesLocalDatabase) return;
    // Back to the seed: unassigned and waiting in the Lead's queue.
    await prisma.event.updateMany({
      where: { id: "evt_submitted" },
      data: {
        status: "SUBMITTED",
        coordinatorId: null,
        decisionReason: null,
        decidedAt: null,
        decidedById: null,
      },
    });
  });

  test.beforeEach(async () => {
    if (!usesLocalDatabase) return;
    // Reset both events used by tests so CI retries stay green. Since
    // SCRUM-165 an unassigned request waits for the Lead, so these journeys
    // start from "Alumni Homecoming" as the Lead would leave it: assigned to
    // coordinator@ and not yet decided.
    await prisma.event.updateMany({
      where: { id: "evt_submitted" },
      data: {
        status: "SUBMITTED",
        coordinatorId: "usr_coordinator",
        decisionReason: null,
        decidedAt: null,
        decidedById: null,
      },
    });
    await prisma.event.updateMany({
      where: { id: "evt_under_review" },
      data: {
        status: "UNDER_REVIEW",
        rejectionOutcome: null,
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

    // Open the event's page and verify the same status badge (SCRUM-208)
    await underReviewRow.getByTestId("view-details-button").click();
    const detailModal = page.getByTestId("event-page");
    await expect(detailModal.getByTestId("status-badge").first()).toHaveAttribute("data-status", "UNDER_REVIEW");
    await page.getByRole("link", { name: "Back to Events" }).click();

    // 4. SCRUM-135 AC3, AC4: an unassigned Submitted request offers no
    // decision; the Under Review one assigned to this Coordinator is rejected.
    const submittedRow = page.getByRole("row", { name: /Submitted — Alumni Homecoming/i });
    await expect(submittedRow).toBeVisible();
    await expect(submittedRow.getByTestId("status-badge")).toHaveAttribute("data-status", "SUBMITTED");
    await expect(submittedRow.getByRole("button", { name: "Reject", exact: true })).toHaveCount(0);

    // Click Reject button
    await underReviewRow.getByRole("button", { name: "Reject", exact: true }).click();
    const rejectModal = page.getByRole("dialog", { name: /Reject event request/i });
    await expect(rejectModal).toBeVisible();

    // Blank reason must keep submit button disabled (refused path)
    const submitRejectBtn = rejectModal.getByRole("button", { name: "Reject request" });
    await expect(submitRejectBtn).toBeDisabled();

    // Provide clear rejection reason and submit decision. SCRUM-126 AC1: the
    // outcome must be chosen too before the decision can be sent.
    await page.getByPlaceholder("Reason for rejection").fill("Insufficient venue capacity for requested date");
    await expect(submitRejectBtn).toBeDisabled();
    await rejectModal.getByLabel("Amend and resubmit").check();
    await expect(submitRejectBtn).toBeEnabled();
    await submitRejectBtn.click();

    // 5. Verify updated status is consistent across list and detail views
    await expect(underReviewRow.getByTestId("status-badge")).toHaveAttribute("data-status", "REJECTED");
    await underReviewRow.getByTestId("view-details-button").click();
    await expect(detailModal.getByTestId("status-badge").first()).toHaveAttribute("data-status", "REJECTED");
  });

  test("SCRUM-81 [AC1, AC2] TC-81-01: coordinator approves an under-review event and status moves to PLANNING (SCRUM-24)", async ({
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
    await expect(underReviewRow.getByTestId("status-badge")).toHaveAttribute("data-status", "PLANNING");

    // 5. Open the event's page and verify the same PLANNING status (SCRUM-81: approval moves it straight to Planning)
    await underReviewRow.getByTestId("view-details-button").click();
    const detailModal = page.getByTestId("event-page");
    await expect(detailModal.getByTestId("status-badge").first()).toHaveAttribute("data-status", "PLANNING");
  });

  test("two users viewing the same event simultaneously see consistent live status without manual refresh (SCRUM-24)", async ({
    browser,
  }) => {
    // Assigns its own event the way the Lead would, so it needs the local
    // database the other write-heavy tests use.
    test.skip(!usesLocalDatabase, "reads its own event; local database only");

    // 1. Sign in as Organiser in first browser context
    const organiserContext = await browser.newContext();
    const organiserPage = await organiserContext.newPage();
    await organiserPage.goto("/login");
    await organiserPage.getByLabel("Email", { exact: true }).fill("organiser@test.local");
    await organiserPage.getByLabel("Password", { exact: true }).fill("Password123!");
    await organiserPage.getByRole("button", { name: "Sign in" }).click();
    await organiserPage.waitForURL("**/events");

    // 2. Organiser creates and submits a new event request
    const syncEventName = `Live Sync Event ${Date.now()}`;
    await organiserPage.getByRole("button", { name: /Create Event Request/i }).first().click();

    await organiserPage.getByLabel("Event Name *").fill(syncEventName);
    await organiserPage.getByLabel("Event Purpose *").fill("Live status synchronization test");
    await organiserPage.getByLabel("Event Description *").fill("Testing live status updates between two concurrent users");
    await organiserPage.getByRole("button", { name: "Next", exact: true }).click();

    await pickDateTime(organiserPage.getByLabel("Proposed Start Date & Time *"), "2027-12-15T09:00");
    await pickDateTime(organiserPage.getByLabel("Proposed End Date & Time *"), "2027-12-15T18:00");
    await organiserPage.getByLabel("Expected Attendance *").fill("50");
    await organiserPage.getByRole("button", { name: "Next", exact: true }).click();

    await fillOther(organiserPage.getByLabel("Venue Requirements *"), "Conference Room");
    await fillOther(organiserPage.getByLabel("Preferred Room Layout *"), "Boardroom");
    await fillOther(organiserPage.getByLabel("Accessibility Needs *"), "Wheelchair ramp");
    await organiserPage.getByRole("button", { name: "Next", exact: true }).click();

    await fillOther(organiserPage.getByLabel("Equipment & Technical Support Requirements *"), "Projector");
    await organiserPage.getByRole("button", { name: "Next", exact: true }).click();

    // SCRUM-171 AC1: Registration needed is required to submit; the note is optional.
    await organiserPage.getByRole("group", { name: "Registration Needed *" }).getByLabel("Yes").check();
    await organiserPage.getByLabel("Registration Notes (Optional)").fill("Online registration");
    await organiserPage.getByRole("button", { name: "Next", exact: true }).click();

    await submitRequest(organiserPage);

    // Verify the submitted event appears on the Organiser's table. Since
    // SCRUM-165 it waits, Submitted, in the Lead's Unassigned queue.
    const organiserRow = organiserPage.getByRole("row", { name: new RegExp(syncEventName) });
    await expect(organiserRow).toBeVisible();
    await expect(organiserRow.getByTestId("status-badge")).toHaveAttribute("data-status", "SUBMITTED");

    // The Lead assigns it to coordinator@ (SCRUM-165, covered end to end in
    // e2e/lead-queue.spec.ts); the Organiser's table picks it up unprompted.
    await prisma.event.updateMany({
      where: { name: syncEventName },
      data: { coordinatorId: "usr_coordinator", status: "UNDER_REVIEW" },
    });
    await expect(organiserRow.getByTestId("status-badge")).toHaveAttribute("data-status", "UNDER_REVIEW", {
      timeout: 12000,
    });

    // Organiser opens the event's page (SCRUM-208)
    await organiserRow.getByTestId("view-details-button").click();
    const organiserModal = organiserPage.getByTestId("event-page");
    await expect(organiserModal.getByTestId("status-badge").first()).toHaveAttribute("data-status", "UNDER_REVIEW");

    // 3. Sign in as the coordinator the request was assigned to.
    const coordinatorEmail = "coordinator@test.local";

    const coordinatorContext = await browser.newContext();
    const coordinatorPage = await coordinatorContext.newPage();
    await coordinatorPage.goto("/login");
    await coordinatorPage.getByLabel("Email", { exact: true }).fill(coordinatorEmail);
    await coordinatorPage.getByLabel("Password", { exact: true }).fill("Password123!");
    await coordinatorPage.getByRole("button", { name: "Sign in" }).click();
    await coordinatorPage.waitForURL("**/events");

    // Locate the newly submitted event on the Coordinator's dashboard
    const coordinatorRow = coordinatorPage.getByRole("row", { name: new RegExp(syncEventName) });
    await expect(coordinatorRow).toBeVisible();
    await expect(coordinatorRow.getByTestId("status-badge")).toHaveAttribute("data-status", "UNDER_REVIEW");

    // 4. Coordinator approves the submitted request
    await coordinatorRow.getByRole("button", { name: /Approve/i }).click();
    await expect(coordinatorRow.getByTestId("status-badge")).toHaveAttribute("data-status", "PLANNING");

    // 5. Organiser page (WITHOUT any manual reload or interaction) receives auto-refresh:
    // Both the open detail modal badge AND the underlying table row update to PLANNING in lockstep
    await expect(organiserModal.getByTestId("status-badge").first()).toHaveAttribute("data-status", "PLANNING", {
      timeout: 12000,
    });

    // Back to the list, whose row also reflects PLANNING
    await organiserPage.getByRole("link", { name: "Back to My Events" }).click();
    await expect(organiserRow.getByTestId("status-badge")).toHaveAttribute("data-status", "PLANNING");

    await organiserContext.close();
    await coordinatorContext.close();
  });

  test("SCRUM-208 TC-208-16: an open event page stays, with a warning, when the event is dropped from the review queue (SCRUM-24)", async ({
    page,
  }) => {
    // 1. Sign in as Event Coordinator (coordinator@test.local)
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("coordinator@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/events");

    // 2. Open the page of an event currently visible in the review queue
    const submittedRow = page.getByRole("row", { name: /Submitted — Alumni Homecoming/i });
    await expect(submittedRow).toBeVisible();
    await submittedRow.getByTestId("view-details-button").click();

    const detailModal = page.getByTestId("event-page");
    await expect(detailModal.getByTestId("status-badge").first()).toHaveAttribute("data-status", "SUBMITTED");

    // 3. Reassign this event to coordinator2 in database to simulate mid-view reassignment (SCRUM-20/21)
    if (usesLocalDatabase) {
      try {
        await prisma.event.update({
          where: { id: "evt_submitted" },
          data: { coordinatorId: "usr_coordinator_2" },
        });

        // 4. On next auto-refresh, event drops from coordinator1's query:
        // The page stays and displays the warning notice instead of silently vanishing
        await expect(
          detailModal.getByTestId("event-no-longer-available-warning"),
        ).toBeVisible({ timeout: 12000 });
      } finally {
        // Clean up database state
        await prisma.event.update({
          where: { id: "evt_submitted" },
          data: { coordinatorId: null },
        });
      }
    }
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
        // SCRUM-171 AC2: resubmitting needs Registration needed answered.
        registrationRequired: true,
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

  test("SCRUM-126 [AC2] TC-126-03: coordinator rejects with a reason, organiser sees it, amends and resubmits it back into review", async ({
    page,
  }) => {
    const reason = "Venue is unavailable on that date — please propose another.";

    // --- Coordinator rejects, and a blank reason is refused ---------------
    await signIn(page, "coordinator@test.local");
    const coordinatorRow = page.getByRole("row", { name: new RegExp(eventName) });
    // Exact: the event's own name link also contains the word "Reject".
    await coordinatorRow.getByRole("button", { name: "Reject", exact: true }).click();

    const rejectDialog = page.getByRole("dialog", { name: /Reject event request/i });
    const rejectButton = rejectDialog.getByRole("button", { name: "Reject request" });
    await expect(rejectButton).toBeDisabled();
    await rejectDialog.getByLabel("Rejection reason").fill("   ");
    await expect(rejectButton).toBeDisabled();

    await rejectDialog.getByLabel("Rejection reason").fill(reason);
    // SCRUM-126 AC1: a reason alone is not enough; the outcome is chosen too.
    await expect(rejectButton).toBeDisabled();
    await rejectDialog.getByLabel("Amend and resubmit").check();
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
    // SCRUM-208 AC2: a final state shows its outcome and reason at the top.
    const details = page.getByTestId("next-step");
    await expect(details.getByText("Rejection reason")).toBeVisible();
    await expect(details.getByText(reason)).toBeVisible();
    // SCRUM-126 AC5: the chosen outcome is shown with the reason.
    await expect(details.getByTestId("rejection-outcome")).toHaveText(
      "Next step: Amend and resubmit",
    );
    await page.getByRole("link", { name: "Back to My Events" }).click();

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
    await fillOther(page.getByLabel("Venue Requirements *"), "Any room — a different date is fine.");
    for (let i = 0; i < 3; i++) {
      await next.click();
    }
    await expect(page.getByRole("heading", { name: /Review Entered Details/i })).toBeVisible();
    await submitRequest(page);
    await expect(
      page.getByText("Event request submitted for review successfully!"),
    ).toBeVisible();

    // It is back in review, and the old decision no longer shows.
    await expect(organiserRow.getByTestId("status-badge")).toHaveAttribute(
      "data-status",
      /^(SUBMITTED|UNDER_REVIEW)$/,
    );
    await organiserRow.getByTestId("view-details-button").click();
    await expect(page.getByTestId("event-page").getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("event-page").getByText("Rejection reason")).toHaveCount(0);
  });
});

/**
 * SCRUM-17 AC1 — "Coordinator can view all fields the Organiser submitted
 * (name, purpose, dates, attendance, venue/accessibility/equipment/
 * registration needs)". Existing tests open View Details as a coordinator
 * but each only checks a subset (a status badge, a clarification message);
 * this is the one place every field from the AC's own list is asserted
 * together, against an event this test fully populates itself rather than
 * relying on a seeded row that may not carry every field.
 */
test.describe("SCRUM-17 — Coordinator reviews a submitted request's full details", () => {
  test.skip(!usesLocalDatabase, "writes its own event; local database only");

  let eventId: string;
  let eventName: string;

  test.beforeEach(async () => {
    eventName = `SCRUM-17 Full Detail ${Date.now()}`;
    const event = await prisma.event.create({
      data: {
        name: eventName,
        purpose: "Showcase the department's annual research output.",
        description: "Owned by the SCRUM-17 e2e spec.",
        status: "UNDER_REVIEW",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        startAt: new Date("2031-08-01T02:00:00Z"),
        endAt: new Date("2031-08-01T10:00:00Z"),
        expectedAttendance: 120,
        venueRequirements: "Auditorium with a raised stage.",
        requiredFacilities: [],
        accessibilityNeeds: "Wheelchair-accessible entrance and seating.",
        preferredLayout: "Theatre",
        equipmentRequirements: "Two lapel microphones and a projector.",
        registrationNotes: "Online registration, capped at capacity.",
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

  test("every field the organiser submitted is visible to the assigned coordinator", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("coordinator@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/events");

    const row = page.getByRole("row", { name: new RegExp(eventName) });
    await expect(row).toBeVisible();
    await row.getByTestId("view-details-button").click();

    // SCRUM-208 AC3: what the Organiser asked for is the Request tab.
    await expect(page.getByRole("heading", { level: 1, name: eventName })).toBeVisible();
    const modal = page.getByTestId("event-page").getByRole("tabpanel");
    await expect(modal.getByText("Showcase the department's annual research output.")).toBeVisible();
    // Dates are shown in Singapore time (SCRUM-129), so 02:00Z/10:00Z become
    // 10:00 am SGT / 6:00 pm SGT.
    await expect(modal.getByText("1 Aug 2031, 10:00 am SGT")).toBeVisible();
    await expect(modal.getByText("1 Aug 2031, 6:00 pm SGT")).toBeVisible();
    await expect(modal.getByText("120 attendees")).toBeVisible();
    await expect(modal.getByText("Auditorium with a raised stage.")).toBeVisible();
    await expect(modal.getByText("Wheelchair-accessible entrance and seating.")).toBeVisible();
    await expect(modal.getByText("Two lapel microphones and a projector.")).toBeVisible();
    await expect(modal.getByText("Online registration, capped at capacity.")).toBeVisible();
  });
});

/**
 * SCRUM-129 AC3 — an event's stored UTC instants are shown in the organiser's
 * list and details in Singapore time, labelled "SGT", with no timezone field.
 * AC2 (events saved under another timezone) is the migration's job and is
 * proven in tests/integration/event-timezone.test.ts.
 */
test.describe("SCRUM-129 — Event times are shown in Singapore time", () => {
  test.skip(!usesLocalDatabase, "writes its own event; local database only");

  let eventId: string;
  let eventName: string;

  test.beforeEach(async () => {
    eventName = `SCRUM-129 SGT Display ${Date.now()}`;
    const event = await prisma.event.create({
      data: {
        name: eventName,
        purpose: "Shows its times in Singapore time.",
        description: "Owned by the SCRUM-129 e2e spec.",
        status: "UNDER_REVIEW",
        organiserId: "usr_organiser",
        coordinatorId: "usr_coordinator",
        // 10:00-18:00 SGT, stored as UTC as it always was.
        startAt: new Date("2031-08-01T02:00:00Z"),
        endAt: new Date("2031-08-01T10:00:00Z"),
        expectedAttendance: 80,
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

  test("SCRUM-129 [AC3 - SGT label] × [AC4 - UTC storage]: the list and details show the stored UTC instants in SGT", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("organiser@test.local");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/events");

    const row = page.getByRole("row", { name: new RegExp(eventName) });
    await expect(row).toContainText("1 Aug 2031, 10:00 am SGT");

    await row.getByTestId("view-details-button").click();
    const modal = page.getByTestId("event-page").getByRole("tabpanel");
    await expect(modal.getByText("1 Aug 2031, 10:00 am SGT")).toBeVisible();
    await expect(modal.getByText("1 Aug 2031, 6:00 pm SGT")).toBeVisible();
    await expect(modal.getByText(/Event Timezone/)).toHaveCount(0);

    // The stored instants were not rewritten.
    const stored = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(stored.startAt?.toISOString()).toBe("2031-08-01T02:00:00.000Z");
    expect(stored.endAt?.toISOString()).toBe("2031-08-01T10:00:00.000Z");
  });
});
