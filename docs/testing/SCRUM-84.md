# SCRUM-84 — Organiser views their own event requests: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-84.md](../backlog/SCRUM-84.md).
Format and conventions: [README.md](README.md). The list is
[events-client.tsx](<../../app/(app)/events/events-client.tsx>); its query
and `filterAndSortEvents` are in [app/(app)/events/](<../../app/(app)/events/>).

Written on 2026-10-12 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176). The tests predate the `SCRUM-n [ACx] TC-n-xx`
title format, so each case names them by their current titles. TC-84-09 was
added on 2026-10-13, so that every e2e test is named by a case.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Signed in as `organiser@test.local` (`Password123!`),
unless the case says otherwise.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-84-01](#tc-84-01) | Negative | AC 1 | Unit, e2e |
| [TC-84-02](#tc-84-02) | Positive | AC 2 | Unit |
| [TC-84-03](#tc-84-03) | Positive | AC 3, AC 4 | Unit, e2e |
| [TC-84-04](#tc-84-04) | Boundary | AC 5 | Unit, e2e |
| [TC-84-05](#tc-84-05) | Positive | AC 6, AC 9 | Unit, e2e |
| [TC-84-06](#tc-84-06) | Positive | AC 7 | Unit, e2e |
| [TC-84-07](#tc-84-07) | Positive | AC 8 | Unit, e2e |
| [TC-84-08](#tc-84-08) | Boundary | AC 6, AC 9 | e2e |
| [TC-84-09](#tc-84-09) | Positive | AC 3, AC 4 at phone width | e2e |

---

### TC-84-01

| Item | Content |
|---|---|
| Test Case ID | TC-84-01 |
| Test Scenario | [Negative] AC 1: an Organiser sees only their own requests |
| Pre-conditions | Both seeded Organisers have requests. Signed in as `organiser2@test.local`. |
| Test Steps | 1. Open **My Events**. |
| Test Data | organiser2's seeded "Another Client's Event — Product Launch"; organiser@test.local's "Draft — Annual Tech Summit" |
| Expected Result | "Another Client's Event — Product Launch" is listed. Nothing of organiser@test.local's, such as "Draft — Annual Tech Summit", appears anywhere on the page. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-84 [AC1, AC2] TC-84-01, TC-84-02, SCRUM-68 [AC1, AC5] TC-68-01: [, Happy Path / Ownership Isolation] executes organiser query filtering only events belonging to logged-in organiser"; `e2e/events.spec.ts` › "SCRUM-68 [AC1, AC5] TC-68-01, SCRUM-84 [AC1] TC-84-01: enforces ownership isolation: organiser2 sees only their own events"

### TC-84-02

| Item | Content |
|---|---|
| Test Case ID | TC-84-02 |
| Test Scenario | [Positive] AC 2: requests in every status are listed |
| Pre-conditions | The Organiser has requests that are Draft, Submitted, Under Review, Approved, Rejected and Completed. |
| Test Steps | 1. Open **My Events** on **All**. <br> 2. Click **Drafts**, then **Submitted**. |
| Test Data | The seeded events |
| Expected Result | **All** lists every one. **Drafts** lists only the drafts; **Submitted** lists every non-draft, in any later status. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-84 [AC1, AC2] TC-84-01, TC-84-02, SCRUM-68 [AC1, AC5] TC-68-01: [, Happy Path / Ownership Isolation] executes organiser query filtering only events belonging to logged-in organiser", "SCRUM-84 [AC2] TC-84-02: given events in DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED and COMPLETED, activeTab …", "SCRUM-84 [AC2] TC-84-02: an organiser's second tab still holds everything they have sent"

### TC-84-03

| Item | Content |
|---|---|
| Test Case ID | TC-84-03 |
| Test Scenario | [Positive] AC 3, AC 4: the list shows the newest first with name, dates and status, and opens a request's full details |
| Pre-conditions | The Organiser has several requests. |
| Test Steps | 1. Open **My Events**. <br> 2. Click a request's row. |
| Test Data | The seeded events |
| Expected Result | The most recently updated request is first. Each row shows the name, proposed dates and status badge. Clicking a row opens that request's full details. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-84 [AC3] TC-84-03: [Implicit Rule / Default Sort] filterAndSortEvents orders list by updatedAt descending by default", "SCRUM-84 [AC3] TC-84-03, SCRUM-23 [AC2] TC-23-02: [Happy Path] exposes event name and current status badge properties for list display", "SCRUM-84 [AC4] TC-84-03: [Happy Path] retrieves full detail model when selecting a specific event request"; `e2e/events.spec.ts` › "SCRUM-84 [AC3, AC4] TC-84-03, SCRUM-208 [AC1] TC-208-01: organiser views list of their own events with names, status badges, and selects an entry for full detail"

### TC-84-04

| Item | Content |
|---|---|
| Test Case ID | TC-84-04 |
| Test Scenario | [Boundary] AC 5: an Organiser with no requests is told so, and offered to create one |
| Pre-conditions | Signed in as an Organiser with no requests (a new test account). |
| Test Steps | 1. Open **My Events**. <br> 2. Click **Create Event Request**. |
| Test Data | None |
| Expected Result | "No events yet" with "Create your first draft event to get started. You can complete the details and submit it for review later." and a **Create Event Request** button, which opens the form. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-84 [AC5] TC-84-04: [Edge Case / Empty State] returns an empty array when an organiser has not created any event requests" (the data); `tests/unit/organiser-empty-state.test.tsx` › "SCRUM-84 [AC5] TC-84-04: says there are no events yet and offers Create Event Request" (the message and the button, beside the header's). The button opens the same form as the header's, which `e2e/events.spec.ts` drives.

### TC-84-05

| Item | Content |
|---|---|
| Test Case ID | TC-84-05 |
| Test Scenario | [Positive] AC 6, AC 9: the list filters by status and by part of a name, and clearing the search restores it |
| Pre-conditions | The Organiser has requests named "Annual Tech Summit" and "Career Fair". |
| Test Steps | 1. Choose a status in **Filter by status**. <br> 2. Type "Annual" in **Search by name or purpose...**. <br> 3. Clear the search. |
| Test Data | "Annual" |
| Expected Result | Step 1 shows only that status. Step 2 shows "Annual Tech Summit" and not "Career Fair". Step 3 brings back every request for the chosen filter. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-84 [AC6] TC-84-05: [Happy Path / Search Filter] filters event list by search query matching event name or purpose via filterAndSortEvents", "SCRUM-84 [AC9] TC-84-05: [Search Cleared State & Partial Matches] matches partial string and restores list when search is cleared"; `e2e/events.spec.ts` › "SCRUM-84 [AC6, AC7, AC8, AC9] TC-84-05, TC-84-06, TC-84-07, SCRUM-168 [AC2] TC-168-02: organiser sorts columns and filters list by status dropdown and search"

### TC-84-06

| Item | Content |
|---|---|
| Test Case ID | TC-84-06 |
| Test Scenario | [Positive] AC 7: the list is newest first, and sorts by a column when asked |
| Pre-conditions | The Organiser has several requests. |
| Test Steps | 1. Open **My Events**. <br> 2. Click **Sort by Name**. |
| Test Data | The seeded events |
| Expected Result | By default the most recently updated is first. After step 2 the rows are in name order. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-84 [AC7] TC-84-06: [Default & Custom Sorting] orders event list by updatedAt descending by default and by name asc when specified"; `e2e/events.spec.ts` › "SCRUM-84 [AC6, AC7, AC8, AC9] TC-84-05, TC-84-06, TC-84-07, SCRUM-168 [AC2] TC-168-02: organiser sorts columns and filters list by status dropdown and search"

### TC-84-07

| Item | Content |
|---|---|
| Test Case ID | TC-84-07 |
| Test Scenario | [Positive] AC 8: a tab, a status filter and a search apply together |
| Pre-conditions | The Organiser has drafts and submitted requests, some containing "Annual". |
| Test Steps | 1. Click **Drafts**. <br> 2. Choose a status in **Filter by status**. <br> 3. Type "Annual" in the search. |
| Test Data | "Annual" |
| Expected Result | Only requests that match the tab, the filter and the search, all three, are listed. |

**Automated by:** `tests/unit/events.test.ts` › "SCRUM-84 [AC8] TC-84-07: [Multi-Criteria Filtering Combination] filters events by active tab AND status filter AND search query simultaneously"; `e2e/events.spec.ts` › "SCRUM-84 [AC6, AC7, AC8, AC9] TC-84-05, TC-84-06, TC-84-07, SCRUM-168 [AC2] TC-168-02: organiser sorts columns and filters list by status dropdown and search"

### TC-84-08

| Item | Content |
|---|---|
| Test Case ID | TC-84-08 |
| Test Scenario | [Boundary] AC 6, AC 9: a search that matches nothing says so, and Clear Filters restores the list |
| Pre-conditions | The Organiser has requests. |
| Test Steps | 1. Type "xyznonexistent99999" in the search. <br> 2. Click **Clear Filters**. |
| Test Data | "xyznonexistent99999" |
| Expected Result | "No requests match the selected filters." with a **Clear Filters** button. Clicking it clears the tab, filter and search, and lists every request again. |

**Automated by:** `e2e/events.spec.ts` › "SCRUM-84 [AC6, AC9] TC-84-08, SCRUM-168 [AC2] TC-168-02: filtered empty state shows 'No requests match' card with a Clear Filters CTA when search yields no results"

### TC-84-09

| Item | Content |
|---|---|
| Test Case ID | TC-84-09 |
| Test Scenario | [Positive] AC 3, AC 4 at phone width: each request is a card with its fields labelled, and its actions still work |
| Pre-conditions | Signed in as the Organiser, at a 375 × 812 screen. The seeded "Draft — Annual Tech Summit" is a draft. |
| Test Steps | 1. Open **My Events**. <br> 2. Look at the first request and a draft. <br> 3. Tap a draft's **Resume Draft**. |
| Test Data | Screen 375 × 812 |
| Expected Result | Each request is a stacked card, not a table row, with **View Details** (an eye icon, named for screen readers) and its "Starts" and "Last Updated" labels shown as text. A draft keeps its 4 px left border. The page doesn't scroll sideways. **Resume Draft** opens "Resume Draft Event Request". |

**Automated by:** `e2e/events.spec.ts` › "SCRUM-84 [AC3, AC4] TC-84-09: restyles rows as stacked cards with no page overflow, and Resume Draft opens the dialog"
