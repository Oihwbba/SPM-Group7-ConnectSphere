# SCRUM-132 — Core pages work on a phone and respond within 2 seconds: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-132.md](../backlog/SCRUM-132.md).
Format and conventions: [README.md](README.md). 360 px and 2 seconds are the
team's own limits; the briefing gives no numbers.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the production build is running (`npm run build && npm run start`, as the
e2e run serves it). Every account's password is `Password123!`.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-132-01](#tc-132-01) | Boundary | AC 1 | e2e |
| [TC-132-02](#tc-132-02) | Boundary | AC 2 | e2e |
| [TC-132-03](#tc-132-03) | Boundary | AC 2 | e2e |
| [TC-132-04](#tc-132-04) | Boundary | AC 2 | e2e |
| [TC-132-05](#tc-132-05) | Positive | AC 3 | e2e |
| [TC-132-06](#tc-132-06) | Positive | AC 3 | e2e |
| [TC-132-07](#tc-132-07) | Positive | AC 4 | e2e |
| [TC-132-08](#tc-132-08) | Negative | AC 4 | Unit |
| [TC-132-09](#tc-132-09) | Positive | AC 4 | Manual (audit) |
| [TC-132-10](#tc-132-10) | Positive | AC 5 | Manual (review) |

### TC-132-01

| Item | Content |
|---|---|
| Test Case ID | TC-132-01 |
| Test Scenario | [Boundary] AC 1: each listed page is usable at 360 px with no horizontal scrolling |
| Pre-conditions | A window 360 px wide. For the safety review page, a safety check awaiting review on "Planning — Freshman Orientation". |
| Test Steps | 1. Open each page as its role, and wait for its content. <br> 2. Try to scroll sideways; for a dialog, check nothing in it reaches past the window's edge. |
| Test Data | Sign-in (signed out); My Event Requests, request form (`organiser@test.local`); event detail, venue search (`?event=evt_planning`), venue availability (`?venue=ven_hall`) (`coordinator@test.local`); booking review (`venuestaff@test.local`); equipment review (`techsupport@test.local`); all-events list, Unassigned queue (`lead@test.local`); event browse, my registrations (`attendee@test.local`); notifications (`organiser@test.local`); safety checks list and review page (`safety@test.local`). |
| Expected Result | No page is wider than the window, and no open dialog reaches past its edge. The request form's step bar wraps onto a second line instead of scrolling sideways. |

**Automated by:** `e2e/phone-and-speed.spec.ts` › "SCRUM-132 [AC1] TC-132-01: …" (14 tests, one per page; the safety pages are one test, local database only)

### TC-132-02

| Item | Content |
|---|---|
| Test Case ID | TC-132-02 |
| Test Scenario | [Boundary] AC 2: viewing an event, searching venues and opening a venue's availability each respond within 2 seconds |
| Pre-conditions | Signed in as the Coordinator, on My Events. |
| Test Steps | 1. Open "Planning — Freshman Orientation"; time until its readiness checklist shows. <br> 2. Open venue search for that event; time until the first result shows. <br> 3. Open Exhibition Hall's availability; time until the calendar shows. |
| Test Data | `coordinator@test.local`; `evt_planning`; `ven_hall` |
| Expected Result | Each takes 2,000 ms or less. Each timing is attached to the run's report. |

**Automated by:** `e2e/phone-and-speed.spec.ts` › "SCRUM-132 [AC2] TC-132-02: viewing an event, searching venues and opening a venue's availability each respond within 2 seconds"

### TC-132-03

| Item | Content |
|---|---|
| Test Case ID | TC-132-03 |
| Test Scenario | [Boundary] AC 2: checking equipment availability responds within 2 seconds |
| Pre-conditions | Signed in as Technical Support, on Equipment. |
| Test Steps | 1. Fill in the period and quantity. <br> 2. Choose Projector; time until the availability shows. |
| Test Data | `techsupport@test.local`; 18 Aug 2032, 9:00 am to 12:00 pm; quantity 1 |
| Expected Result | "_n_ of _m_ available" shows within 2,000 ms. |

**Automated by:** `e2e/phone-and-speed.spec.ts` › "SCRUM-132 [AC2] TC-132-03: checking equipment availability responds within 2 seconds"

### TC-132-04

| Item | Content |
|---|---|
| Test Case ID | TC-132-04 |
| Test Scenario | [Boundary] AC 2: submitting a registration responds within 2 seconds |
| Pre-conditions | A Confirmed event open for registration, with places left, made by the test. |
| Test Steps | 1. As an Attendee, open the event. <br> 2. Register; time until it shows as registered. |
| Test Data | `attendee4@test.local` |
| Expected Result | "Registered" shows within 2,000 ms. |

**Automated by:** `e2e/phone-and-speed.spec.ts` › "SCRUM-132 [AC2] TC-132-04: submitting a registration responds within 2 seconds" (local database only)

### TC-132-05

| Item | Content |
|---|---|
| Test Case ID | TC-132-05 |
| Test Scenario | [Positive] AC 3: a Planning event's status and outstanding actions are visible without scrolling on a desktop screen |
| Pre-conditions | A 1280 × 720 window; signed in as the Coordinator. |
| Test Steps | 1. Open "Planning — Freshman Orientation" from My Events, without scrolling. |
| Test Data | `coordinator@test.local` |
| Expected Result | The status badge, the readiness checklist's Venue booking, Equipment and Safety check items, and Confirm event are all on screen. The checklist comes right under the header, before the event's details. |

**Automated by:** `e2e/phone-and-speed.spec.ts` › "SCRUM-132 [AC3] TC-132-05: a Planning event's status and outstanding actions show without scrolling"

### TC-132-06

| Item | Content |
|---|---|
| Test Case ID | TC-132-06 |
| Test Scenario | [Positive] AC 3: a Confirmed event's status and confirmed arrangements are visible without scrolling on a desktop screen |
| Pre-conditions | A 1280 × 720 window; signed in as the Organiser. |
| Test Steps | 1. Open "Confirmed — Charity Gala" from My Events, without scrolling. |
| Test Data | `organiser@test.local` |
| Expected Result | The status badge and the confirmed venue and equipment are on screen. |

**Automated by:** `e2e/phone-and-speed.spec.ts` › "SCRUM-132 [AC3] TC-132-06: a Confirmed event's status and confirmed arrangements show without scrolling"

### TC-132-07

| Item | Content |
|---|---|
| Test Case ID | TC-132-07 |
| Test Scenario | [Positive] AC 4: closing and reopening registration confirms the change |
| Pre-conditions | A Confirmed event open for registration. |
| Test Steps | 1. As the Organiser, close registration. <br> 2. As the Coordinator, reopen it. |
| Test Data | `organiser@test.local`, `coordinator@test.local` |
| Expected Result | 1. "Registration closed." 2. "Registration reopened." (Before SCRUM-132, the card changed with no confirmation.) |

**Automated by:** `e2e/registration-period.spec.ts` › "SCRUM-75 [AC6] TC-75-06, TC-75-07: the Organiser closes registration, the Attendee sees it closed, and after the Coordinator reopens it the Attendee registers"

### TC-132-08

| Item | Content |
|---|---|
| Test Case ID | TC-132-08 |
| Test Scenario | [Negative] AC 4: an empty start or end in a clarification answer or change request says which field to fix and how |
| Pre-conditions | — |
| Test Steps | 1. Validate an empty start and end. <br> 2. Validate a given start and end. |
| Test Data | `""`; `2031-06-01T01:00:00.000Z` to `2031-06-01T05:00:00.000Z` |
| Expected Result | 1. "Choose the event date and a start time." on Start and "Choose an end time." on End (SCRUM-190), not Zod's "String must contain at least 1 character(s)". 2. Valid. |

**Automated by:** `tests/unit/validation-messages.test.ts` › "SCRUM-132 [AC4] TC-132-08: an empty start or end names the field and asks for a date and time" and "SCRUM-132 [AC4] TC-132-08: a start and end that are given pass this check"

### TC-132-09

| Item | Content |
|---|---|
| Test Case ID | TC-132-09 |
| Test Scenario | [Positive] AC 4: every action that changes data shows a confirmation |
| Pre-conditions | — |
| Test Steps | 1. List every server action a page calls that writes. <br> 2. For each, check the page shows a confirmation on success, and that a refusal shows the action's message next to the field it names. |
| Test Data | The client components under `app/` and `components/` that import from an `actions.ts`. |
| Expected Result | Every writing action confirms success (a toast, or a status message in the form). Two exceptions, both deliberate: marking a notification read happens as it opens, and the list or page it opens is the confirmation; the edit-details dialog confirms through `showSaveReply`'s `close`. |

**Automated by:** Manual audit, run for this story on 19 Oct 2026 over every writing action a client component imports; the only one without a confirmation was closing or reopening registration, fixed in TC-132-07. Re-run the same day against `main` at `4f7fdc97`, after SCRUM-25, SCRUM-38, SCRUM-75, SCRUM-161 and SCRUM-171 merged: their writing actions (editing details, recording unavailability, retiring a venue, recording a suitability judgement, closing registration) all confirm success. The individual confirmations are covered by each story's own tests.

### TC-132-10

| Item | Content |
|---|---|
| Test Case ID | TC-132-10 |
| Test Scenario | [Positive] AC 5: the README states Release 1 is not load-tested, with the design choices that support growth |
| Pre-conditions | — |
| Test Steps | 1. Read the README's "Performance and growth" section. |
| Test Data | — |
| Expected Result | It says Release 1 isn't load-tested for three years of growth, names the 360 px and 2-second limits and where they are checked, lists the design choices that support growth, and says what would need work first. |

**Automated by:** Manual (review)
