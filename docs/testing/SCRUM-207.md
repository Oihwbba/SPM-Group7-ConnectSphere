# SCRUM-207 — Shared page conventions on every page: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-207.md](../backlog/SCRUM-207.md).
Format and conventions: [README.md](README.md).

**Shared pre-conditions for every case:** the database is migrated and seeded
(`npm run db:deploy && npm run db:seed`), the app is running, and every seeded
account signs in with `Password123!`.

**Two parts.** The change is split in two pull requests so each fits the
reviewer: part 1 holds the shared pieces, My Events, the request form, the
event pop-up and notifications; part 2, stacked on it, holds Booking
Requests, Request a Venue, Venue Search and the Equipment pages. A case whose
tests arrive with part 2 says so under **Automated by**.

**What this change delivers.** The first part of the story: the shared
pieces every page now uses (one status badge, empty states on the lists it
changed, one confirmation pop-up for submitting a request and approving a
booking), and the customer's page-by-page changes built on them (TC-207-11 to
TC-207-24). **AC 1, AC 4 and AC 5 are not yet met across every page:**
TC-207-01, TC-207-02, TC-207-09 and TC-207-10 are still to do, marked Manual
until a later pull request builds and automates them; each lists the pages
that remain.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-207-01](#tc-207-01) | Positive | AC 1 | **Still to do** (Manual) |
| [TC-207-02](#tc-207-02) | Positive | AC 1 | **Still to do** (Manual) |
| [TC-207-03](#tc-207-03) | Positive | AC 2 | Unit |
| [TC-207-04](#tc-207-04) | Positive | AC 3 | Unit |
| [TC-207-05](#tc-207-05) | Positive | AC 3 | Unit |
| [TC-207-06](#tc-207-06) | Negative | AC 3 | e2e |
| [TC-207-07](#tc-207-07) | Positive | AC 4 | e2e |
| [TC-207-08](#tc-207-08) | Positive | AC 4 | e2e |
| [TC-207-09](#tc-207-09) | Positive, Negative | AC 4 | **Still to do** (Manual) |
| [TC-207-10](#tc-207-10) | Positive | AC 5 | **Still to do** (Manual) |
| [TC-207-11](#tc-207-11) | Positive | User story | e2e |
| [TC-207-12](#tc-207-12) | Positive | User story | e2e |
| [TC-207-13](#tc-207-13) | Positive | User story | e2e |
| [TC-207-14](#tc-207-14) | Positive | User story | e2e |
| [TC-207-15](#tc-207-15) | Positive | User story | Unit, e2e |
| [TC-207-16](#tc-207-16) | Positive, Negative | User story | Unit |
| [TC-207-17](#tc-207-17) | Positive, Boundary | User story | Unit |
| [TC-207-18](#tc-207-18) | Positive, Boundary | User story | Unit |
| [TC-207-19](#tc-207-19) | Positive | User story | Unit |
| [TC-207-20](#tc-207-20) | Positive | User story | Unit |
| [TC-207-21](#tc-207-21) | Positive | User story | Unit |
| [TC-207-22](#tc-207-22) | Boundary | User story | Unit |
| [TC-207-23](#tc-207-23) | Positive | User story | e2e |
| [TC-207-24](#tc-207-24) | Positive | User story | e2e |

"User story" cases check the customer's page-by-page changes that make pages
look and behave the same; each supports the story as a whole rather than one
criterion.

---

### TC-207-01

| Item | Content |
|---|---|
| Test Case ID | TC-207-01 |
| Test Scenario | [Positive] AC 1: every page has one title and a one-line description of what it is for |
| Pre-conditions | Signed in once as each role. |
| Test Steps | 1. Open every page in the role's menu, and every page reached from one (details, forms, search). <br> 2. Read the top of each page. |
| Test Data | Every seeded account |
| Expected Result | Each page shows exactly one title (level-1 heading) and, under it, one line saying what the page is for. |

**Automated by:** Manual. **Still to do** on these pages (audited 23 Oct):

- **Equipment** (`/equipment`) and **Browse Events** (`/events` as an Attendee): the title is for screen readers only, with no visible title or description.
- **Booking Requests** (`/bookings`) and **Venue Search** (`/venues/search`): the description runs to several sentences, not one line.
- **An unassigned request** (`/queue/[id]`) and **an event's page for Attendees** (`/events/[id]`): a title, but no line saying what the page is for.
- The event pop-up on **My Events** has no description line; SCRUM-208 replaces it with a page.

### TC-207-02

| Item | Content |
|---|---|
| Test Case ID | TC-207-02 |
| Test Scenario | [Positive] AC 1: a page that isn't a menu page has a back link |
| Pre-conditions | Signed in as the Coordinator Lead (`lead@test.local`). |
| Test Steps | 1. Open **All Events**, then one event's page. <br> 2. Open **Venue Search** from an event, and a venue's page from **Venues**. |
| Test Data | `lead@test.local`, `coordinator@test.local` |
| Expected Result | Each page reached from a menu page has a back link to the page it came from; menu pages have none. |

**Automated by:** Manual. **Still to do** on these pages (audited 23 Oct):

- Every detail page has a back link, but they read and look different: "Back to all events" (`/all-events/[id]`), "Back to the queue" (`/queue/[id]`), "Safety checks" (`/safety-checks/[id]`), "Venue Catalogue" (`/venues/[id]`), "Back to events" and "Back to my registrations" (`/events/[id]`). They need one wording and one style.
- **Notifications** (`/notifications`), reached from the bell, has no back link.

### TC-207-03

| Item | Content |
|---|---|
| Test Case ID | TC-207-03 |
| Test Scenario | [Positive] AC 2: the new request tables show each status with the shared badge and its name from the stories |
| Pre-conditions | Signed in as Technical Support; one request is Pending Review (seed `eqr_planning`). |
| Test Steps | 1. Open **Equipment Requests**. <br> 2. Find the request's row. |
| Test Data | `techsupport@test.local` |
| Expected Result | The row's Status column shows the shared status badge reading "Pending Review", the same badge the request's details and the Coordinator's table use. |

**Automated by** (in part 2, the stacked pull request for Booking Requests, Venues and Equipment): `tests/unit/shared-conventions-lists.test.tsx` › "SCRUM-207 [AC2] TC-207-03: …"

### TC-207-04

| Item | Content |
|---|---|
| Test Case ID | TC-207-04 |
| Test Scenario | [Positive] AC 3: an empty review queue says why it is empty and what comes next |
| Pre-conditions | Signed in as Technical Support; no request is waiting for review. |
| Test Steps | 1. Open **Equipment Requests**. |
| Test Data | `techsupport@test.local` |
| Expected Result | "No requests waiting for review", and "New equipment requests from coordinators appear here." No table is shown. |

**Automated by** (in part 2, the stacked pull request for Booking Requests, Venues and Equipment): `tests/unit/shared-conventions-lists.test.tsx` › "SCRUM-207 [AC3] TC-207-04: …"

### TC-207-05

| Item | Content |
|---|---|
| Test Case ID | TC-207-05 |
| Test Scenario | [Positive] AC 3: a Coordinator with no equipment requests is told what to do next |
| Pre-conditions | Signed in as a Coordinator with an approved event and no equipment requests. |
| Test Steps | 1. Open **Equipment Requests**. |
| Test Data | `coordinator@test.local` |
| Expected Result | "No equipment requests yet", "Ask for projectors, microphones and anything else from the equipment list for one of your approved events.", and a **New request** button in the empty state. |

**Automated by** (in part 2, the stacked pull request for Booking Requests, Venues and Equipment): `tests/unit/shared-conventions-lists.test.tsx` › "SCRUM-207 [AC3] TC-207-05: …"

### TC-207-06

| Item | Content |
|---|---|
| Test Case ID | TC-207-06 |
| Test Scenario | [Negative] AC 3: a search that matches nothing says so, and what to try next |
| Pre-conditions | Signed in as Venue Staff, then as a Coordinator. |
| Test Steps | 1. As Venue Staff, search the booking queue for `no-such-request-anywhere`. <br> 2. As a Coordinator, search venues on their own for a period no venue fits. |
| Test Data | `venuestaff@test.local`, `coordinator@test.local` |
| Expected Result | 1: "No requests match …", and no rows. 2: "No venues match" and "Try another time or location, or turn off a filter." |

**Automated by** (in part 2, the stacked pull request for Booking Requests, Venues and Equipment): `e2e/bookings.spec.ts` › "SCRUM-50 [AC2], SCRUM-52 [AC1-AC3], SCRUM-53 [AC1, AC4], SCRUM-207 [AC3, AC4] TC-207-06, TC-207-08: …"; `e2e/venue-search.spec.ts` › "SCRUM-38 [AC2, AC6, AC10] TC-38-07, TC-38-11, SCRUM-207 [AC3] TC-207-06: …"

### TC-207-07

| Item | Content |
|---|---|
| Test Case ID | TC-207-07 |
| Test Scenario | [Positive] AC 4: submitting an event request confirms it in the shared pop-up |
| Pre-conditions | Signed in as an Organiser. |
| Test Steps | 1. Fill in every step of **Create Event Request** and submit it. <br> 2. Choose **View Details** in the pop-up. |
| Test Data | `organiser@test.local` |
| Expected Result | 1: a pop-up with a tick, "Request submitted", **Close** and **View Details**. 2: the request's details open. |

**Automated by:** `e2e/shared-conventions.spec.ts` › "SCRUM-207 [AC4] TC-207-07: …"

### TC-207-08

| Item | Content |
|---|---|
| Test Case ID | TC-207-08 |
| Test Scenario | [Positive] AC 4: approving a booking request confirms it in the same pop-up, with a way to the event |
| Pre-conditions | Signed in as Venue Staff; one booking request is Pending. |
| Test Steps | 1. Open the request's details from the queue and choose **Approve**. |
| Test Data | `venuestaff@test.local` |
| Expected Result | The same pop-up as TC-207-07, saying "Approved: … is now booked", with **View event**. |

**Automated by** (in part 2, the stacked pull request for Booking Requests, Venues and Equipment): `e2e/bookings.spec.ts` › "SCRUM-50 [AC2], SCRUM-52 [AC1-AC3], SCRUM-53 [AC1, AC4], SCRUM-207 [AC3, AC4] TC-207-06, TC-207-08: …"

### TC-207-09

| Item | Content |
|---|---|
| Test Case ID | TC-207-09 |
| Test Scenario | [Positive, Negative] AC 4: success and error messages appear in the same place on every page, and an error says what to do next |
| Pre-conditions | Signed in once as each role. |
| Test Steps | 1. On every page with an action, complete one successfully. <br> 2. Make the same action fail (a missing field, a refused state). |
| Test Data | Every seeded account |
| Expected Result | Every success and every error shows in the same place, and every error message ends with what to do next. |

**Automated by:** Manual. **Still to do** on these pages (audited 23 Oct): messages show either as a toast in the corner or inline beside the form, depending on the page. Toast and inline messages are mixed on:

- **My Events**, whose request form shows its errors inline and everything else as a toast;
- **Request a Venue** (`/bookings/new`);
- **Equipment** (`/equipment`), the reserve card and the schedule panel;
- **Venues** and **Venue Availability**, the venue form, Retire and Record unavailability;
- the event pop-up's panels: clarification, change request, change decision, reconsideration, readiness checklist, registration control and notes.

Inline only: **Venue Search** and the sign-in page. Toast only: **Booking Requests**, **Equipment Requests**, the unassigned queue, **All Events** (reassign) and **Safety Checks** (outcome). Every error message has still to be checked for what to do next.

### TC-207-10

| Item | Content |
|---|---|
| Test Case ID | TC-207-10 |
| Test Scenario | [Positive] AC 5: every action that can't be undone asks for confirmation in the same dialog |
| Pre-conditions | Signed in as each role that has such an action (discard a draft, withdraw a request, reject, cancel, retire a venue). |
| Test Steps | 1. Start each irreversible action. <br> 2. Choose the dialog's way back, then start it again and confirm. |
| Test Data | Every seeded account |
| Expected Result | Each asks in the same dialog, with the same layout and buttons; the way back changes nothing. |

**Automated by:** Manual. **Still to do** on these pages (audited 23 Oct): each irreversible action asks in a dialog of its own, built separately, and two don't ask at all (marked *no confirmation*). They all need the one shared dialog:

- **My Events**: discard a draft, reject a request;
- **Equipment Requests**: withdraw a request (Coordinator); reject a request (Technical Support, *no confirmation*);
- **Booking Requests**: reject a request;
- the event pop-up: cancel the event, withdraw or release a venue booking (readiness checklist), decide a change request, the reconsideration choices;
- **Venues**: retire a venue;
- an event's page for Attendees (`/events/[id]`): withdraw a registration (*no confirmation*).

### TC-207-11

| Item | Content |
|---|---|
| Test Case ID | TC-207-11 |
| Test Scenario | [Positive] User story: the request form's steps sit on one line, and its fields carry no helper lines |
| Pre-conditions | Signed in as an Organiser. |
| Test Steps | 1. Open **Create Event Request**. <br> 2. Go through each step. |
| Test Data | `organiser@test.local` |
| Expected Result | The step names sit on one line, the current one underlined; no field has a helper line under it. |

**Automated by:** `e2e/shared-conventions.spec.ts` › "SCRUM-207 TC-207-11: …"

### TC-207-12

| Item | Content |
|---|---|
| Test Case ID | TC-207-12 |
| Test Scenario | [Positive] User story: Save as Draft keeps the form open and says it saved; saving again updates the same draft |
| Pre-conditions | Signed in as an Organiser. |
| Test Steps | 1. Enter a name and choose **Save as Draft**. <br> 2. Change a field and save again. |
| Test Data | `organiser@test.local` |
| Expected Result | The form stays open and the button reads "Saved as draft"; there is one draft, with the second save's values. |

**Automated by:** `e2e/shared-conventions.spec.ts` › "SCRUM-207 TC-207-12: …"

### TC-207-13

| Item | Content |
|---|---|
| Test Case ID | TC-207-13 |
| Test Scenario | [Positive] User story: My Events reads Last Updated, and a row's actions are icons on one line that say what they do |
| Pre-conditions | Signed in as an Organiser with a draft. |
| Test Steps | 1. Open **My Events**. <br> 2. Look at a draft's row. |
| Test Data | `organiser@test.local` |
| Expected Result | The column reads "Last Updated"; Resume Draft, View Details and Discard are icon buttons, each named for screen readers, on one line. The status filter is the app's dropdown. |

**Automated by:** `e2e/shared-conventions.spec.ts` › "SCRUM-207 TC-207-13: …"

### TC-207-14

| Item | Content |
|---|---|
| Test Case ID | TC-207-14 |
| Test Scenario | [Positive] User story: an event with a clarification offers Clarifications, which opens its thread on a full-width tab |
| Pre-conditions | Signed in as an Organiser whose Under Review event has a clarification. |
| Test Steps | 1. Open **My Events**. <br> 2. Choose **Clarifications** on the event's row. |
| Test Data | `organiser@test.local` |
| Expected Result | The details open on the Clarification tab, showing the question; the two tabs share the pop-up's full width. |

**Automated by:** `e2e/shared-conventions.spec.ts` › "SCRUM-207 TC-207-14: …"

### TC-207-15

| Item | Content |
|---|---|
| Test Case ID | TC-207-15 |
| Test Scenario | [Positive] User story: notifications are reached from one bell beside the user's name, not from the menu |
| Pre-conditions | Signed in as each role. |
| Test Steps | 1. Look at the menu and the header. <br> 2. Choose the bell. |
| Test Data | Every seeded account |
| Expected Result | No menu item for Notifications; one bell beside the name, with the unread count, opens them. |

**Automated by:** `tests/unit/nav.test.ts` › "SCRUM-207 TC-207-15: …"; `e2e/shared-conventions.spec.ts` › "SCRUM-207 TC-207-15: …"

### TC-207-16

| Item | Content |
|---|---|
| Test Case ID | TC-207-16 |
| Test Scenario | [Positive, Negative] User story: the Organiser's Actions required tab lists the requests waiting on them, and no others |
| Pre-conditions | Signed in as an Organiser with a request rejected to amend, one rejected to start again, and one with an unanswered clarification. |
| Test Steps | 1. Open **My Events** and choose **Actions required**. |
| Test Data | `organiser@test.local` |
| Expected Result | The amend-and-resubmit rejection and the unanswered clarification are listed; the start-again rejection, drafts and every other state are not. |

**Automated by:** `tests/unit/actions-required.test.ts` › "SCRUM-207 TC-207-16: …"

### TC-207-17

| Item | Content |
|---|---|
| Test Case ID | TC-207-17 |
| Test Scenario | [Positive, Boundary] User story: a pill dropdown's answer is saved as text and read back as the same choices |
| Pre-conditions | None: the reading and writing of answers. |
| Test Steps | 1. Choose options and type an Other answer; save. <br> 2. Open the request again. |
| Test Data | Venue, layout, accessibility and equipment answers |
| Expected Result | The same options show as pills and the rest as Other; an answer naming no option is kept untouched; case and punctuation don't matter. |

**Automated by:** `tests/unit/requirement-choices.test.ts` › "SCRUM-207 TC-207-17: …"

### TC-207-18

| Item | Content |
|---|---|
| Test Case ID | TC-207-18 |
| Test Scenario | [Positive, Boundary] User story: notes and histories are a timeline, joined by a dotted line, with the author in a pill |
| Pre-conditions | An event with one operational note, and one with two. |
| Test Steps | 1. Open each event's operational notes. |
| Test Data | `venuestaff@test.local` |
| Expected Result | One note shows no line; two are joined by a dotted line. Each names its author in a pill with a person icon, read out as "by" the name. |

**Automated by:** `tests/unit/shared-conventions-pdf3.test.tsx` › "SCRUM-207 TC-207-18: …"

### TC-207-19

| Item | Content |
|---|---|
| Test Case ID | TC-207-19 |
| Test Scenario | [Positive] User story: notification cards are white with a violet left edge, read or unread |
| Pre-conditions | Signed in with a read and an unread notification. |
| Test Steps | 1. Open the notifications. |
| Test Data | `organiser@test.local` |
| Expected Result | Every card is white with a thick violet left edge; an unread one also has its dot. |

**Automated by:** `tests/unit/shared-conventions-pdf3.test.tsx` › "SCRUM-207 TC-207-19: …"

### TC-207-20

| Item | Content |
|---|---|
| Test Case ID | TC-207-20 |
| Test Scenario | [Positive] User story: the booking queue is a table of key facts, and requests are decided only in their details |
| Pre-conditions | Signed in as Venue Staff with a Pending request. |
| Test Steps | 1. Open **Booking Requests**. <br> 2. Choose the eye on a row. |
| Test Data | `venuestaff@test.local` |
| Expected Result | 1: the row shows the key facts and an eye, but no Approve, Reject or Hold. 2: the details offer them. |

**Automated by** (in part 2, the stacked pull request for Booking Requests, Venues and Equipment): `tests/unit/booking-queue.test.tsx` › "SCRUM-207 TC-207-20: …"

### TC-207-21

| Item | Content |
|---|---|
| Test Case ID | TC-207-21 |
| Test Scenario | [Positive] User story: a clarification thread shows the earlier questions too, oldest first |
| Pre-conditions | An event with an answered clarification and a newer open one. |
| Test Steps | 1. Open the event's Clarification tab. |
| Test Data | `organiser@test.local` |
| Expected Result | The earlier question and answer show above the current one, as one thread. |

**Automated by:** `tests/unit/clarification.test.ts` › "SCRUM-207 TC-207-21: …"

### TC-207-22

| Item | Content |
|---|---|
| Test Case ID | TC-207-22 |
| Test Scenario | [Boundary] User story: the shared time picker offers times on its step |
| Pre-conditions | None: the picker's rounding. |
| Test Steps | 1. Open a time picker with a 30-minute step at 09:10, at 09:30 and at 23:31. |
| Test Data | — |
| Expected Result | 09:10 rounds up to 09:30; 09:30 stays; at 23:31, past the day's last 30-minute step, nothing is offered. |

**Automated by** (in part 2, the stacked pull request for Booking Requests, Venues and Equipment): `tests/unit/venue-search-time-field.test.tsx` › "SCRUM-207 TC-207-22: …"

### TC-207-23

| Item | Content |
|---|---|
| Test Case ID | TC-207-23 |
| Test Scenario | [Positive] User story: venue search shows results only once a search is run, and offers Search again |
| Pre-conditions | Signed in as the assigned Coordinator of a Planning event. |
| Test Steps | 1. Open the event and choose **Find a venue**. <br> 2. Choose **Search**. |
| Test Data | `coordinator@test.local` |
| Expected Result | 1: the event's card beside the form, and no results. 2: the results, with **Search again** back to the form. |

**Automated by** (in part 2, the stacked pull request for Booking Requests, Venues and Equipment): `e2e/venue-search.spec.ts` › "SCRUM-38 [AC1, AC2, AC8, AC9, AC14] TC-38-01, TC-38-09, TC-38-10, TC-38-14, SCRUM-207 TC-207-23: …"

### TC-207-24

| Item | Content |
|---|---|
| Test Case ID | TC-207-24 |
| Test Scenario | [Positive] User story: equipment requests are a table, and each opens in a pop-up with its details and its history |
| Pre-conditions | A rig request waiting for review. |
| Test Steps | 1. As Technical Support, open the request from its row and review it. <br> 2. As the Coordinator, open it from their table and choose **History**. |
| Test Data | `techsupport@test.local`, `coordinator@test.local` |
| Expected Result | Both open a pop-up with a **Details** tab (lines and actions) and a **History** tab (the timeline of every change). |

**Automated by** (in part 2, the stacked pull request for Booking Requests, Venues and Equipment): `e2e/equipment-request-review.spec.ts` › "SCRUM-28 [AC2, AC3, AC5, AC6] TC-28-02, TC-28-03, TC-28-09, TC-28-10, SCRUM-207 TC-207-24: …" and "SCRUM-28 [AC4, AC5, AC6] TC-28-07, TC-28-09, TC-28-10, SCRUM-207 TC-207-24: …"
