# SCRUM-168 — Remove the placeholder search bar from the top bar: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-168.md](../backlog/SCRUM-168.md).
Format and conventions: [README.md](README.md). The top bar is part of the
layout every signed-in page shares,
[app/(app)/layout.tsx](<../../app/(app)/layout.tsx>), so one page per role
shows it as every page does. Since SCRUM-48 the notifications bell sits beside
the profile menu.

Written on 2026-10-13 from the acceptance criteria, then mapped to the tests
that already existed (SCRUM-176), so that every e2e test is named by a case.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. Every seeded account's password is `Password123!`.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-168-01](#tc-168-01) | Positive | AC 1 | e2e at phone width; desktop width is manual |
| [TC-168-02](#tc-168-02) | Positive | AC 2 | e2e |
| [TC-168-03](#tc-168-03) | Boundary | AC 3 | e2e |

---

### TC-168-01

| Item | Content |
|---|---|
| Test Case ID | TC-168-01 |
| Test Scenario | [Positive] AC 1: the top bar has no search box, for every role |
| Pre-conditions | Signed out. |
| Test Steps | 1. Sign in as each seeded role. <br> 2. On the page the role lands on, look at the top bar. |
| Test Data | `organiser@test.local`, `coordinator@test.local`, `venuestaff@test.local`, `techsupport@test.local`, `attendee@test.local` |
| Expected Result | The top bar shows the ConnectSphere brand, the notifications bell and the profile menu, and nothing to type into: no search box and no text field. |

**Automated by:** `e2e/top-bar.spec.ts` › "SCRUM-168 [AC1, AC3]: at phone width, ${email} sees no search box, the brand on the left, and the bell and profile menu together on the right", run once for each of the five roles. The test runs at phone width. The header has no markup that changes with the width, but a pass at desktop width is **Manual**.

### TC-168-02

| Item | Content |
|---|---|
| Test Case ID | TC-168-02 |
| Test Scenario | [Positive] AC 2: the searches inside pages keep working |
| Pre-conditions | Signed out. |
| Test Steps | 1. As the Organiser, search **My Events**, then search for something no request matches and click **Clear Filters**. <br> 2. As the Coordinator, search the event list. <br> 3. As Venue Staff, search the pending booking queue. <br> 4. As the Attendee, search the events list. |
| Test Data | "Annual"; "xyznonexistent99999" (as `organiser2@test.local`); a test event's name; a request's notes; "WINE" |
| Expected Result | Each search narrows its own list to the matches, a search with no match says so, and clearing it restores the list, as before the search box was removed. |

**Automated by:** `e2e/events.spec.ts` › "SCRUM-84 [AC6, AC7, AC8, AC9] TC-84-05, TC-84-06, TC-84-07, SCRUM-168 [AC2] TC-168-02: organiser sorts columns and filters list by status dropdown and search", "SCRUM-84 [AC6, AC9] TC-84-08, SCRUM-168 [AC2] TC-168-02: filtered empty state shows 'No requests match' card with a Clear Filters CTA when search yields no results"; `e2e/coordinator-assigned-events.spec.ts` › "SCRUM-69 [AC2] TC-69-03, SCRUM-168 [AC2] TC-168-02: the list shows each event's name, proposed date and status, and can be searched"; `e2e/bookings.spec.ts` › "SCRUM-53 [AC2] TC-53-02, TC-53-03: rejecting needs a written reason, and the reason is saved" (its queue search); `e2e/attendee-events.spec.ts` › "SCRUM-72 [AC1] TC-72-08, SCRUM-168 [AC2] TC-168-02: typing a keyword narrows the list to matching events, ignoring case"

### TC-168-03

| Item | Content |
|---|---|
| Test Case ID | TC-168-03 |
| Test Scenario | [Boundary] AC 3: at phone width the brand is on the left and the bell and profile menu are together on the right, with no gap where the search box was |
| Pre-conditions | A 375 × 812 screen. |
| Test Steps | 1. Sign in as each seeded role. <br> 2. Measure where the brand, the bell and the profile menu sit in the top bar. |
| Test Data | The five roles in TC-168-01; screen 375 × 812 |
| Expected Result | All three sit inside the one bar. The brand starts in the left quarter of the screen. The bell and the profile menu are side by side (at most 8 px apart) with the menu at the right edge (within 32 px). The page is no wider than the screen. |

**Automated by:** `e2e/top-bar.spec.ts` › "SCRUM-168 [AC1, AC3]: at phone width, ${email} sees no search box, the brand on the left, and the bell and profile menu together on the right", run once for each of the five roles
