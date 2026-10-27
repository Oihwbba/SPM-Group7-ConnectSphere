# SCRUM-211 — One layout for every work queue: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-211.md](../backlog/SCRUM-211.md).
Format and conventions: [README.md](README.md).

**AC1 is being agreed with the PO.** These cases follow the proposed wording:
"Every queue shows the same four columns: event, event date, what's asked,
and requested (date and how long ago). Other details appear when an item is
opened. Each queue keeps its current default order, and users can sort by
event date or requested." The backlog snapshot still has the earlier wording
(oldest first, "waiting since").

**Shared pre-conditions for every case:** the database is migrated and seeded
(`npm run db:deploy && npm run db:seed`), the app is running, and every seeded
account signs in with `Password123!`. The four queues and who works them:
the **Unassigned Queue** (`lead@test.local`), **Bookings**
(`venuestaff@test.local`), **Equipment Requests** (`techsupport@test.local`,
the review queue) and **Safety Checks** (`safety@test.local`).

**How every queue is laid out.** The title with how many items wait, then the
same controls: **Waiting** (the default), **Decided** and **All**, and a search
box that matches the event's name. Then the list in four columns, **Event**,
**Event date**, **What's asked** and **Requested** (e.g. "23 Oct (3 days ago)",
"Today (2 hours ago)"), with any mark (Overdue, Held, Earlier request first,
In Review, Competing requests, Needs Reconsideration) as a small badge beside
the event. A row opens its item on the same page: its details on the left, the
decision on the right (on a phone, details first). The filter, search, sort and
open item are kept in the link. The decisions call the same actions as before,
with the same rules, permissions, locks, notifications and messages.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-211-01](#tc-211-01) | Positive | AC 1 | Unit, e2e |
| [TC-211-02](#tc-211-02) | Positive, Boundary | AC 1 | Unit, e2e |
| [TC-211-03](#tc-211-03) | Positive | AC 2 | Unit, integration, e2e |
| [TC-211-04](#tc-211-04) | Positive | AC 2 | Unit, e2e |
| [TC-211-05](#tc-211-05) | Positive | AC 2 | Unit, e2e |
| [TC-211-06](#tc-211-06) | Positive | AC 3 | Unit, e2e |
| [TC-211-07](#tc-211-07) | Positive | AC 4 | Unit, e2e |
| [TC-211-08](#tc-211-08) | Boundary | AC 4 | Unit, e2e |
| [TC-211-09](#tc-211-09) | Negative | AC 3, AC 4 | e2e |
| [TC-211-10](#tc-211-10) | Negative | AC 3 | e2e |
| [TC-211-11](#tc-211-11) | Positive | AC 3 | e2e |

## TC-211-01

**Every queue lists its items in the same four columns, in its own default order.**

1. Open each queue.

**Expected:** the columns are Event, Event date, What's asked and Requested,
and nothing else. What's asked is one short line: "Needs a Coordinator",
"Seminar Room 2.1 for 40", "Projector ×1, Wireless Microphone ×4", "Safety
check, 40 people"; a long one is cut short, not wrapped. Requested is the
submission date and how long ago. The Unassigned Queue, Equipment Requests and
Safety Checks list the oldest request first; Bookings the soonest event first
(SCRUM-52 AC1). The Unassigned Queue still marks Overdue (SCRUM-165).

*Automated:* `tests/unit/queues.test.ts` › every "SCRUM-211 [AC1] TC-211-01" and
"SCRUM-211 [AC1, AC2] TC-211-01" test; `tests/unit/booking-queue.test.tsx` ›
"SCRUM-207 TC-207-20, SCRUM-211 [AC1] TC-211-01: …"; `e2e/work-queues.spec.ts` ›
the four "SCRUM-211 [AC1, AC2] TC-211-01, TC-211-02, TC-211-03, TC-211-04: …"
tests; `e2e/lead-queue.spec.ts` (Overdue).

## TC-211-02

**Sorting by Event date or Requested.**

1. Click the **Event date** heading, then again.
2. Click the **Requested** heading. Refresh the page.

**Expected:** the list sorts by that column, ascending first, then the other
way (a column already sorted flips first); the heading shows which column is
sorted and which way. An item without an event date sorts last either way.
The sort is kept in the link, so a refresh keeps it.

*Automated:* `tests/unit/queues.test.ts` › every "SCRUM-211 [AC1] TC-211-02" test;
`e2e/work-queues.spec.ts` › the four "SCRUM-211 [AC1, AC2] TC-211-01, TC-211-02,
TC-211-03, TC-211-04: …" tests.

## TC-211-03

**The same status filter in every queue: Waiting, Decided, All.**

1. Open each queue; choose **Decided**, then **All**.

**Expected:** Waiting is the default. Decided lists the queue's decided items:
requests a Lead assigned, bookings approved or rejected, equipment requests
approved or rejected, checks with an outcome (only for events the officer may
review, SCRUM-166 AC6). All lists both. An opened decided item says what was
decided, with no decision buttons. The filter is kept in the link.

*Automated:* `tests/unit/queues.test.ts` › "SCRUM-211 [AC2] TC-211-03: …" tests;
`tests/integration/work-queues.test.ts` › every "SCRUM-211 [AC2] TC-211-03" test;
`e2e/work-queues.spec.ts` › the four "SCRUM-211 [AC1, AC2] TC-211-01, TC-211-02,
TC-211-03, TC-211-04: …" tests.

## TC-211-04

**The same search box: it matches the event's name.**

1. Type words from an event's name; then a word no event has.

**Expected:** only items for matching events are listed; every word must
match, and case doesn't matter. Nothing else (what's asked, the venue, the
coordinator) is searched. The search is kept in the link.

*Automated:* `tests/unit/queues.test.ts` › "SCRUM-211 [AC2] TC-211-04: …";
`e2e/work-queues.spec.ts` › the four "SCRUM-211 [AC1, AC2] TC-211-01, TC-211-02,
TC-211-03, TC-211-04: …" tests; `e2e/bookings.spec.ts` (search step).

## TC-211-05

**The two empty states.**

1. Open a queue with nothing waiting.
2. Search for a word no event has.

**Expected:** 1: "Nothing waiting. You're all caught up." 2: "No requests match
'…'" ("No checks match" on Safety Checks), with **Clear search**, which returns
the full list.

*Automated:* `tests/unit/booking-queue.test.tsx` › "SCRUM-52 [AC4] TC-52-06,
SCRUM-211 [AC2] TC-211-05: …"; `tests/unit/shared-conventions-lists.test.tsx` ›
"SCRUM-207 [AC3] TC-207-04, SCRUM-211 [AC2] TC-211-05: …";
`e2e/work-queues.spec.ts` (search step of each list test; the caught-up state,
TC-211-08).

## TC-211-06

**An opened item: details on the left, the decision on the right, the buttons in the same order.**

1. Open an item in each queue (for Equipment Requests, start the review).

**Expected:** the item opens on the same page, with **All requests** back to
the list and its position ("2 of 5"). The decision is on the right, positive
first, then the middle option, then Reject:

| Queue | Buttons |
|---|---|
| Unassigned Queue | Assign (with the Coordinator picker) |
| Bookings | Approve · Hold · Reject (Hold only for a Pending request; an approved hold offers Reject only, SCRUM-163 AC7) |
| Equipment Requests | Start review first, as before; then Approve · Suggest alternative · Reject |
| Safety Checks | Approve · Request changes · Reject |

Reject asks first, in a confirmation dialog, with its reason or note still
required; Request changes asks for its note and picked arrangements; Hold
asks for its expiry and note.

*Automated:* `tests/unit/booking-queue.test.tsx` › "SCRUM-53, SCRUM-211 [AC3]
TC-211-06: …"; `e2e/work-queues.spec.ts` › the four "SCRUM-211 [AC3, AC4]
TC-211-06, TC-211-07, TC-211-08: …" tests.

## TC-211-07

**After a decision, the next waiting item opens.**

1. With three items waiting, decide the first.

**Expected:** a short success message, and the next waiting item in the
current filter, search and sort opens; after the last in the list, the first
still waiting. Starting an equipment review, or suggesting an alternative, is
not a decision: the request stays open.

*Automated:* `tests/unit/queues.test.ts` › "SCRUM-211 [AC4] TC-211-07: …" and
"SCRUM-211 [AC2, AC4] TC-211-07, TC-211-08: …"; `e2e/work-queues.spec.ts` › the
four "SCRUM-211 [AC3, AC4] TC-211-06, TC-211-07, TC-211-08: …" tests.

## TC-211-08

**Boundary — after the last waiting item: all caught up.**

**Expected:** "Nothing waiting. You're all caught up.", even with a search
still in the link.

*Automated:* `tests/unit/queues.test.ts` › "SCRUM-211 [AC4] TC-211-08: …" and
"SCRUM-211 [AC2, AC4] TC-211-07, TC-211-08: …"; `e2e/work-queues.spec.ts` › the
four "SCRUM-211 [AC3, AC4] TC-211-06, TC-211-07, TC-211-08: …" tests.

## TC-211-09

**Negative — a refused decision stays on the item, says why as before, and writes nothing.**

1. Unassigned Queue: another Lead assigns the request while it is open; choose **Assign**.
2. Bookings: a competing request was submitted earlier; choose **Approve**.
3. Equipment Requests: in review, choose **Reject** with no note.
4. Safety Checks: another officer records the check while it is open; choose **Approve**.

**Expected:** the same message as before, shown in the decision panel (and as
an error message): 1 "This request is already assigned to Cara Coordinator.";
2 "An earlier request for … is still waiting …" (SCRUM-134 AC2); 3 "Give the
coordinator a reason for rejecting the request.", beside the note; 4 "This
check is already Approved by Sasha Safety on …; nothing was changed." The
item stays open, and nothing it holds changes.

*Automated:* `e2e/work-queues.spec.ts` › "SCRUM-211 [AC3] TC-211-09: …",
"SCRUM-211 [AC3] TC-211-09, SCRUM-134 [AC2]: …", "SCRUM-211 [AC3] TC-211-09,
SCRUM-28 [AC3]: …" and "SCRUM-211 [AC3] TC-211-09, SCRUM-166 [AC3]: …";
`e2e/first-come.spec.ts` (SCRUM-134).

## TC-211-10

**Negative — Venue Staff see what the booking needs, not the whole event (SCRUM-17).**

1. As Venue Staff, open a request whose event has a purpose, an open
   clarification question and registration.

**Expected:** the details show the venue, the period with setup and
turnaround, attendance next to capacity, layout and facilities, the requesting
Coordinator, overlapping bookings and unavailability, competing requests with
their submission times, the suitability judgement, the Organiser's venue
answers and the operational notes; not the event's purpose, its clarification
or its registrations.

*Automated:* `e2e/work-queues.spec.ts` › "SCRUM-211 [AC3] TC-211-10, SCRUM-17: …".

## TC-211-11

**On a phone, the details come first, then the decision.**

1. At 390 px wide, open a request in the Unassigned Queue.

**Expected:** the decision sits below the details, and the page doesn't scroll
sideways.

*Automated:* `e2e/work-queues.spec.ts` › "SCRUM-211 [AC3] TC-211-11: …".
