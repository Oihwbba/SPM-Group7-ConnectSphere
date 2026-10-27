# SCRUM-208 — One page per event, not a pop-up: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-208.md](../backlog/SCRUM-208.md).
Format and conventions: [README.md](README.md).

**Shared pre-conditions for every case:** the database is migrated and seeded
(`npm run db:deploy && npm run db:seed`), the app is running, and every seeded
account signs in with `Password123!`. Unless a case says otherwise, the event
is Under Review, organised by `organiser@test.local` (Olivia Organiser) and
assigned to `coordinator@test.local` (Cody Coordinator), with an open question
from the Coordinator that lets the Organiser also update Expected attendance.

**How the page is built.** An event opens at `/events/[id]`. The top of the
page, shown whatever tab is open, has:

- a back link ("← Back to My Events", or "← Back to Events" for a Coordinator);
- the event's name as the title, with the Coordinator's own actions beside it
  (Edit details, Cancel event; Find a venue is on the Arrangements tab, SCRUM-209) where they apply;
- its **progress**, Request → Review → Planning → Confirmed → Completed: the
  steps done ticked, the current one marked with a glowing dot, a Rejected
  request marked where it stopped and a Cancelled event shown as far as it got;
- the **Next step** banner: what happens next, whose turn it is, and who is
  handling the event ("Handled by …"). When it is the viewer's turn it has a
  way straight there; a Coordinator deciding a request under review has Ask,
  Approve and Reject in it.

Below it are the tabs, in the order the work happens: **Request**,
**Clarification**, **Arrangements**, **Changes**, **Registrations** (only when
the event needs registration) and **Notes**. The open tab is part of the link
(`?tab=`), and a tab that needs the viewer shows a dot or a count. Key facts
are shown as **stat strips**, each a round icon, a label and a bold value, split
by thin lines: the Request tab's schedule and attendance, a Confirmed event's
arrangements, and registration's status, period and count. Every panel is the
one the pop-up showed, with the same rules and the same people allowed to act.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-208-01](#tc-208-01) | Positive | AC 1 | Unit, e2e |
| [TC-208-02](#tc-208-02) | Positive | AC 2 | Unit, e2e |
| [TC-208-03](#tc-208-03) | Positive | AC 2 | Unit, e2e |
| [TC-208-04](#tc-208-04) | Positive | AC 2 | Unit, e2e |
| [TC-208-05](#tc-208-05) | Positive | AC 2 | Unit |
| [TC-208-06](#tc-208-06) | Positive | AC 2 | Unit, e2e |
| [TC-208-07](#tc-208-07) | Positive | AC 2 | Unit, e2e |
| [TC-208-08](#tc-208-08) | Positive | AC 3 | Unit, e2e |
| [TC-208-09](#tc-208-09) | Negative | AC 3 | Unit, e2e |
| [TC-208-10](#tc-208-10) | Positive | AC 3 | e2e |
| [TC-208-11](#tc-208-11) | Positive, Negative | AC 3, AC 4 | Unit, e2e |
| [TC-208-12](#tc-208-12) | Boundary | AC 3, AC 4 | e2e |
| [TC-208-13](#tc-208-13) | Negative | AC 5 | e2e |
| [TC-208-14](#tc-208-14) | Positive | SCRUM-132 (phone) | e2e |
| [TC-208-15](#tc-208-15) | Negative | AC 1 (Attendees unchanged) | e2e |
| [TC-208-16](#tc-208-16) | Positive | SCRUM-24 (live view) | e2e |
| [TC-208-17](#tc-208-17) | Positive | AC 2, AC 3 | Unit, e2e |

---

### TC-208-01

| Item | Content |
|---|---|
| Test Case ID | TC-208-01 |
| Test Scenario | [Positive] AC 1: opening an event from the list goes to its own page, with its own link; there is no pop-up |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. On **My Events**, choose the event's name. <br> 2. Go back, and choose its **View Details**. <br> 3. Open a notification about the event. |
| Test Data | `organiser@test.local` |
| Expected Result | Each opens `/events/<id>` with the event's page, and no dialog. **← Back to My Events** returns to the list. An old `/events?event=<id>` link goes to the same page. |

**Automated by:** `e2e/event-page.spec.ts` › "SCRUM-208 [AC1, AC2] TC-208-01, TC-208-02, TC-208-03: …"; `e2e/events.spec.ts` › "SCRUM-84 [AC3, AC4] TC-84-03, SCRUM-208 [AC1] TC-208-01: organiser views list of their own events with names, status badges, and selects an entry for full detail"; `tests/unit/notifications.test.ts` › "SCRUM-48 [AC5] TC-48-06, SCRUM-208 [AC1] TC-208-01: …"

### TC-208-02

| Item | Content |
|---|---|
| Test Case ID | TC-208-02 |
| Test Scenario | [Positive] AC 2: the top shows the event's name as the title, its progress from request to completed event, and who is handling it |
| Pre-conditions | Signed in as the Organiser. Further events: one Rejected, one Cancelled from Confirmed, one Completed. |
| Test Steps | 1. Open the Under Review event. <br> 2. Open each tab in turn. <br> 3. Open the Rejected, Cancelled and Completed events. |
| Test Data | `organiser@test.local` |
| Expected Result | 1: the title is the event's name only, with no status badge beside it. The progress shows Request ticked and Review as the current step; a screen reader hears "Status: Under Review". The Next step banner says "Handled by Cody Coordinator" ("Waiting for a Coordinator" while none is assigned). 2: the top stays the same on every tab. 3: Rejected is marked at Review in red, with only Request ticked; the Cancelled event has Request, Review and Planning ticked, then Cancelled; the Completed event has every step ticked and none current. |

**Automated by:** `tests/unit/event-page-parts.test.tsx` › "SCRUM-208 [AC2] TC-208-02: …" (five tests); `tests/unit/event-next-step.test.ts` › every "SCRUM-208 [AC2] TC-208-02: …" test; `e2e/event-page.spec.ts` › "SCRUM-208 [AC1, AC2] TC-208-01, TC-208-02, TC-208-03: …"; `e2e/reassign.spec.ts` (the Coordinator's name after a reassignment)

### TC-208-03

| Item | Content |
|---|---|
| Test Case ID | TC-208-03 |
| Test Scenario | [Positive] AC 2: an open question is the Organiser's turn, with a button straight to it; the Coordinator sees they are waiting, with no button |
| Pre-conditions | The event has an open question. |
| Test Steps | 1. As the Organiser, open the event and choose the banner's button. <br> 2. As the Coordinator, open the event. |
| Test Data | `organiser@test.local`, `coordinator@test.local` |
| Expected Result | 1: "Your turn: answer the Coordinator's question" with **Answer the question**, which opens the Clarification tab. 2: "Waiting for Olivia Organiser to answer your question", shown as information, with no button. |

**Automated by:** `tests/unit/event-next-step.test.ts` › every "SCRUM-208 [AC2] TC-208-03: …" test; `tests/integration/event-page-data.test.ts` › "SCRUM-208 [AC2] TC-208-03: …"; `e2e/event-page.spec.ts` › "… TC-208-03: …" (both tests)

### TC-208-04

| Item | Content |
|---|---|
| Test Case ID | TC-208-04 |
| Test Scenario | [Positive] AC 2: a request waiting for review is the Coordinator's to decide, right in the banner; the Organiser waits; with no Coordinator, both wait for one |
| Pre-conditions | The event is Under Review with no open question; a second event is Submitted with no Coordinator. |
| Test Steps | 1. As the Organiser, open the first event. <br> 2. As the Coordinator, open it and choose **Approve** in the banner. <br> 3. Open the Submitted one. |
| Test Data | `organiser@test.local`, `coordinator@test.local` |
| Expected Result | 1: "Waiting for Cody Coordinator to review the request", with no button. 2: "Your turn: review the request, then approve it, reject it or ask a question", with **Ask**, **Approve** and **Reject**; approving keeps the page open, now in Planning. 3: "Waiting for a Coordinator to be assigned". |

**Automated by:** `tests/unit/event-next-step.test.ts` › every "SCRUM-208 [AC2] TC-208-04: …" test; `e2e/event-page.spec.ts` › "SCRUM-208 [AC2] TC-208-04: …"

### TC-208-05

| Item | Content |
|---|---|
| Test Case ID | TC-208-05 |
| Test Scenario | [Positive] AC 2: in Planning, the next step is the first readiness item still open, and says whose it is |
| Pre-conditions | The event is in Planning: first with a Pending booking for Hall A, then with the venue approved and equipment Not decided, then with everything complete. |
| Test Steps | 1. Open the event as the Coordinator, and as the Organiser, at each point. |
| Test Data | `coordinator@test.local`, `organiser@test.local` |
| Expected Result | Pending venue: "Waiting for Venue Staff to approve Hall A", with no button, for both. Equipment not decided: the Coordinator sees "Your turn: request the equipment, or record that none is needed" with **Go to Arrangements**; the Organiser sees "Waiting for Cody Coordinator to …". All complete: "Your turn: confirm the event". |

**Automated by:** `tests/unit/event-next-step.test.ts` › every "SCRUM-208 [AC2] TC-208-05: …" test; `tests/integration/event-page-data.test.ts` › "SCRUM-208 [AC2, AC4] TC-208-05: …" and "SCRUM-208 [AC2] TC-208-05: …"

### TC-208-06

| Item | Content |
|---|---|
| Test Case ID | TC-208-06 |
| Test Scenario | [Positive] AC 2: a change request waiting for a decision comes before the checklist |
| Pre-conditions | The event has a change request waiting. |
| Test Steps | 1. Open it as the Coordinator, then as the Organiser. |
| Test Data | `coordinator@test.local`, `organiser@test.local` |
| Expected Result | Coordinator: "Your turn: decide the change request", opening on Changes, whose tab shows the count 1; Approve and Reject there are green and red. Organiser: "Waiting for Cody Coordinator to decide your change request". |

**Automated by:** `tests/unit/event-next-step.test.ts` › every "SCRUM-208 [AC2] TC-208-06: …" test; `tests/integration/event-page-data.test.ts` › "SCRUM-208 [AC2] TC-208-06: …"; `e2e/change-decision.spec.ts` › "SCRUM-128 [AC1, AC2, AC4, AC5] TC-128-13, SCRUM-208 [AC2] TC-208-06: …"

### TC-208-07

| Item | Content |
|---|---|
| Test Case ID | TC-208-07 |
| Test Scenario | [Positive] AC 2: a Rejected, Cancelled or Completed event shows its outcome and reason instead of a next step |
| Pre-conditions | One event Rejected with a reason and "Amend and resubmit"; one Cancelled with a reason. |
| Test Steps | 1. Open each as the Organiser. |
| Test Data | `organiser@test.local` |
| Expected Result | Rejected: "This request was rejected.", "Rejection reason: …" and "Next step: Amend and resubmit". Cancelled: "This event was cancelled.", the reason and when. No button. |

**Automated by:** `tests/unit/event-next-step.test.ts` › every "SCRUM-208 [AC2] TC-208-07: …" test; `tests/integration/event-page-data.test.ts` › "SCRUM-208 [AC2] TC-208-07: …"; `e2e/events.spec.ts` › "SCRUM-126 [AC2] TC-126-03: …"; `e2e/rejection-outcome.spec.ts`; `e2e/close-event.spec.ts`

### TC-208-08

| Item | Content |
|---|---|
| Test Case ID | TC-208-08 |
| Test Scenario | [Positive] AC 3: the tab holding the next step opens first, and is marked; otherwise Request |
| Pre-conditions | The event has an open question; a second has none. |
| Test Steps | 1. As the Organiser, open each event without a tab in the link. |
| Test Data | `organiser@test.local` |
| Expected Result | The first opens on Clarification, which has a dot. The second opens on Request. |

**Automated by:** `tests/unit/event-next-step.test.ts` › "SCRUM-208 [AC3] TC-208-08: …"; `e2e/event-page.spec.ts` › "… TC-208-01, TC-208-02, TC-208-03: …"

### TC-208-09

| Item | Content |
|---|---|
| Test Case ID | TC-208-09 |
| Test Scenario | [Negative] AC 3: a link naming a tab the page doesn't have opens the default tab |
| Pre-conditions | The event has an open question. |
| Test Steps | 1. Open `/events/<id>?tab=nonsense`. |
| Test Data | `organiser@test.local` |
| Expected Result | The page opens on Clarification, as with no tab in the link. |

**Automated by:** `tests/unit/event-next-step.test.ts` › "SCRUM-208 [AC3] TC-208-09: …"; `e2e/event-page.spec.ts` › "SCRUM-208 [AC3] TC-208-09, TC-208-10: …"

### TC-208-10

| Item | Content |
|---|---|
| Test Case ID | TC-208-10 |
| Test Scenario | [Positive] AC 3: the open tab is part of the link, so a shared link and a refresh keep it |
| Pre-conditions | Signed in as the Organiser. |
| Test Steps | 1. Open `/events/<id>?tab=notes`. <br> 2. Choose **Request**. <br> 3. Refresh the page. |
| Test Data | `organiser@test.local` |
| Expected Result | 1: Notes is open. 2: the link ends `?tab=request`. 3: Request is still open. |

**Automated by:** `e2e/event-page.spec.ts` › "SCRUM-208 [AC3] TC-208-09, TC-208-10: …"

### TC-208-11

| Item | Content |
|---|---|
| Test Case ID | TC-208-11 |
| Test Scenario | [Positive, Negative] AC 3, AC 4: the clarification thread reads as a conversation with who and when; only the Organiser has the answer box |
| Pre-conditions | The event has an open question. |
| Test Steps | 1. As the Organiser, open the Clarification tab. <br> 2. As the Coordinator, open it. |
| Test Data | `organiser@test.local`, `coordinator@test.local` |
| Expected Result | Both see the question, oldest first, from Cody Coordinator with its time. 1: "You can also update: Expected attendance.", the field, and the answer box under the question. 2: "The Organiser can also update: Expected attendance." and no answer box. |

**Automated by:** `e2e/event-page.spec.ts` › "SCRUM-208 [AC2, AC3, AC4] TC-208-03, TC-208-11: …"; `tests/unit/clarification.test.ts` › "SCRUM-208 [AC3] TC-208-11: …"; `e2e/clarification.spec.ts`; `e2e/clarification-and-amend.spec.ts`

### TC-208-12

| Item | Content |
|---|---|
| Test Case ID | TC-208-12 |
| Test Scenario | [Boundary] AC 3, AC 4: a tab that can never apply is hidden; a tab with nothing in it yet says so in one line |
| Pre-conditions | The event doesn't need registration, isn't approved yet, and has no question from the Coordinator. |
| Test Steps | 1. Open the event. <br> 2. Open **Arrangements**. <br> 3. Open **Clarification**. |
| Test Data | `organiser@test.local` |
| Expected Result | 1: the tabs are Request, Clarification, Arrangements, Changes and Notes, with no Registrations. 2: "Arrangements start once the request is approved." 3: "No questions from the Coordinator." |

**Automated by:** `e2e/event-page.spec.ts` › "SCRUM-208 [AC3, AC4] TC-208-12: …"

### TC-208-13

| Item | Content |
|---|---|
| Test Case ID | TC-208-13 |
| Test Scenario | [Negative] AC 5: another person's event, and one that doesn't exist, give the same not-found page |
| Pre-conditions | One event is organiser2's; one is assigned to Cody Coordinator. |
| Test Steps | 1. As the Organiser, open organiser2's event by its link, then a made-up id. <br> 2. As Cara Coordinator, open Cody's event by its link, then a made-up id. |
| Test Data | `organiser@test.local`, `coordinator2@test.local` |
| Expected Result | Every one answers 404, with nothing about the event shown. |

**Automated by:** `tests/integration/event-page-data.test.ts` › "SCRUM-208 [AC5] TC-208-13: …" (four cases); `e2e/access-control.spec.ts` › "SCRUM-208 [AC5] TC-208-13: …"; `e2e/event-page.spec.ts` › "SCRUM-208 [AC5] TC-208-13: …"; `e2e/notifications.spec.ts` › "SCRUM-48 [AC5, AC6] TC-48-09: …"

### TC-208-14

| Item | Content |
|---|---|
| Test Case ID | TC-208-14 |
| Test Scenario | [Positive] On a phone (SCRUM-132): the tabs scroll sideways, the Next step stays above them, and the page doesn't scroll sideways |
| Pre-conditions | A 360 px wide window. |
| Test Steps | 1. Open the event. |
| Test Data | `organiser@test.local` |
| Expected Result | The tabs row scrolls sideways; the Next step banner is above it; nothing on the page reaches past the window's edge. |

**Automated by:** `e2e/event-page.spec.ts` › "SCRUM-208 TC-208-14: …"; `e2e/phone-and-speed.spec.ts` › "SCRUM-132 [AC1] TC-132-01: the event detail …"

### TC-208-15

| Item | Content |
|---|---|
| Test Case ID | TC-208-15 |
| Test Scenario | [Negative] AC 1: an Attendee's event page at the same address is unchanged |
| Pre-conditions | The seeded Confirmed event is open for registration. |
| Test Steps | 1. As an Attendee, open `/events/evt_confirmed`. |
| Test Data | `attendee@test.local` |
| Expected Result | The Attendee's event page, with its registration state; not the Organiser's or Coordinator's page. The event's Organiser at the same address gets their own event page, never the Attendee's. |

**Automated by:** `e2e/event-page.spec.ts` › "SCRUM-208 [AC1] TC-208-15: …"; `e2e/attendee-events.spec.ts` › "SCRUM-208 [AC1] TC-208-15: the Organiser at their Confirmed event's URL gets their own event page, never the attendee view"; `e2e/several-venues.spec.ts`

### TC-208-16

| Item | Content |
|---|---|
| Test Case ID | TC-208-16 |
| Test Scenario | [Positive] SCRUM-24: an open event page stays current; one the viewer can no longer see says so instead of disappearing |
| Pre-conditions | The Organiser and the Coordinator each have the event's page open. |
| Test Steps | 1. The Coordinator approves the request on their list. <br> 2. The event is reassigned while the first Coordinator has it open. |
| Test Data | `organiser@test.local`, `coordinator@test.local` |
| Expected Result | 1: the Organiser's page shows Planning within a few seconds, without a reload. 2: the first Coordinator's page keeps its last view, with "This event request is no longer available in your view…". |

**Automated by:** `tests/unit/readiness-actions.test.ts` › every "SCRUM-208 TC-208-16: …" test; `e2e/events.spec.ts` › "two users viewing the same event simultaneously see consistent live status …" and "SCRUM-208 TC-208-16: an open event page stays, with a warning, when the event is dropped from the review queue"

### TC-208-17

| Item | Content |
|---|---|
| Test Case ID | TC-208-17 |
| Test Scenario | [Positive] AC 2, AC 3: the key facts show as strips of stats where they belong |
| Pre-conditions | The event is Confirmed, at Grand Auditorium, with 2 projectors reserved and registration open with 2 of 250 places taken. |
| Test Steps | 1. As the Coordinator, open **Request**. <br> 2. Open **Arrangements**. <br> 3. Open **Registrations**, and choose **Close registration** in the list's header. |
| Test Data | `coordinator@test.local` |
| Expected Result | 1: Schedule & Attendance comes first, across the page: the proposed date with its times underneath, the expected attendance and the duration; the other four sections below it, two by two. 2: Venue, Date & time, Equipment (one type to a line, in normal text) and Venue bookings (an approval with a green tick). 3: Status "Open" in green, the period on two lines, and "2" with "of 250" in normal text; closing makes the status "Registration closed", in red. |

**Automated by:** `tests/unit/event-page-parts.test.tsx` › "SCRUM-208 [AC2, AC3] TC-208-17: …"; `e2e/event-page.spec.ts` › "SCRUM-208 [AC1, AC2] TC-208-01, TC-208-02, TC-208-03: …" (the Request tab's attendance); `e2e/confirm.spec.ts` › "SCRUM-81 [AC3, AC5, AC6, AC7] TC-81-02, TC-81-05, TC-81-06, TC-81-08: …" (the confirmed venue and equipment); `e2e/event-edit.spec.ts` › "SCRUM-25 [AC4, AC5, AC6] TC-25-22: …" and `e2e/registration-period.spec.ts` › "SCRUM-75 [AC6] TC-75-06, TC-75-07: …" (closing and reopening registration)
