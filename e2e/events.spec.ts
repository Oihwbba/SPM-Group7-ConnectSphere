import { test, expect } from "@playwright/test";

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
