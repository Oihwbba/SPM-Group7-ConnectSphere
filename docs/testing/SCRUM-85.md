# SCRUM-85 — Attendees are kept informed when an event they registered for changes or is cancelled: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-85.md](../backlog/SCRUM-85.md).
Format and conventions: [README.md](README.md). Cancelling an event and its
notices are SCRUM-82's; this story checks the Attendee's side of them.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. The tester signs in as `attendee4@test.local` unless
the case says otherwise. Every account's password is `Password123!`.

"Last confirmed" is what the event's `confirmed*` fields hold: the date, time
and every approved venue when it was last Confirmed (SCRUM-81). An event "being
re-planned" is one back in Planning after being Confirmed, as a flagged venue
(SCRUM-26) or an approved change request (SCRUM-128) leaves it.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-85-01](#tc-85-01) | Positive, Concurrency | AC 1, AC 6 | Unit, integration, e2e |
| [TC-85-02](#tc-85-02) | Positive | AC 2, AC 3, AC 5, AC 11 | Unit, integration, e2e |
| [TC-85-03](#tc-85-03) | Negative | AC 2, AC 11 | Unit |
| [TC-85-04](#tc-85-04) | Boundary | AC 2 | Unit |
| [TC-85-05](#tc-85-05) | Concurrency | AC 6 | Unit, integration |
| [TC-85-06](#tc-85-06) | Positive, Negative | AC 5, AC 8, AC 10, AC 11 | Unit, e2e |
| [TC-85-07](#tc-85-07) | Positive, Negative | AC 9, AC 10 | Unit, integration, e2e |
| [TC-85-08](#tc-85-08) | Positive | AC 7 | Unit, e2e |
| [TC-85-09](#tc-85-09) | Positive | AC 4, AC 5, AC 12 | Unit, integration, e2e |

### TC-85-01

| Item | Content |
|---|---|
| Test Case ID | TC-85-01 |
| Test Scenario | [Positive, Concurrency] AC 1, AC 6: registering sends one notification confirming it; registering again, or twice at once, sends no second one |
| Pre-conditions | A Confirmed event open for registration. |
| Test Steps | 1. Register. <br> 2. Register again, and register twice at the same moment. |
| Test Data | — |
| Expected Result | Step 1: one notification "You're registered", "You're registered for "_name_".". Step 2: refused as already registered; still one registration and one notification. |

**Automated by:** `tests/unit/registration-actions.test.ts` › "SCRUM-85 [AC1, AC6] TC-85-01: …" and "SCRUM-85 [AC6] TC-85-01: …"; `tests/integration/attendee-updates.test.ts` › "SCRUM-85 [AC1, AC6] TC-85-01: an Attendee registering twice at the same moment gets one registration and one confirmation"; `e2e/attendee-updates.spec.ts` › "SCRUM-85 [AC1, AC7] TC-85-01, TC-85-08: registering through the page sends a notice confirming it, which opens the event"

### TC-85-02

| Item | Content |
|---|---|
| Test Case ID | TC-85-02 |
| Test Scenario | [Positive] AC 2, AC 3, AC 5, AC 11: an event re-planned with a new date, time or venue is confirmed again; each Attendee still registered is told once, with every venue, and stays registered |
| Pre-conditions | Two Attendees registered; one has withdrawn. The event is back in Planning and its start, end or venues changed. |
| Test Steps | 1. As its Coordinator, confirm the event again. <br> 2. Open Notifications as each Attendee. |
| Test Data | — |
| Expected Result | Only the Attendee still registered gets one "An event you registered for has changed" notice: "_name_" is confirmed with new details: _date, time_ at _every venue_. Your registration still stands." Their registration is still Registered. The withdrawn Attendee gets nothing. |

**Automated by:** `tests/unit/event-confirm.test.ts` › "SCRUM-85 [AC2, AC3, AC5, AC11] TC-85-02: …" (4 tests: start moved, end moved, venue added, venue replaced); `tests/unit/replanning-views.test.tsx` › "SCRUM-85 [AC2] TC-85-02: …"; `tests/integration/attendee-updates.test.ts` › "SCRUM-85 [AC2, AC3, AC5, AC9, AC11] TC-85-02, TC-85-07: …"; `e2e/attendee-updates.spec.ts` › "SCRUM-85 [AC2, AC7, AC8, AC9, AC10, AC11] …"

### TC-85-03

| Item | Content |
|---|---|
| Test Case ID | TC-85-03 |
| Test Scenario | [Negative] AC 2, AC 11: confirmed again with the same date, time and venues tells no Attendee anything |
| Pre-conditions | The event is back in Planning with nothing changed. |
| Test Steps | 1. Confirm it again. |
| Test Data | — |
| Expected Result | No "has changed" notice. |

**Automated by:** `tests/unit/event-confirm.test.ts` › "SCRUM-85 [AC2, AC11] TC-85-03: …"

### TC-85-04

| Item | Content |
|---|---|
| Test Case ID | TC-85-04 |
| Test Scenario | [Boundary] AC 2: the first confirmation records what Attendees are told, and tells nobody of a change |
| Pre-conditions | A Planning event never confirmed, with two approved venues. |
| Test Steps | 1. Confirm it. |
| Test Data | — |
| Expected Result | The event records its date, time and both venues, oldest first ("Name — Location"). No "has changed" notice. |

**Automated by:** `tests/unit/event-confirm.test.ts` › "SCRUM-85 [AC2] TC-85-04: …" (2 tests); `tests/unit/replanning-views.test.tsx` › "SCRUM-85 [AC2] TC-85-04: nothing confirmed before is not a change"

### TC-85-05

| Item | Content |
|---|---|
| Test Case ID | TC-85-05 |
| Test Scenario | [Concurrency] AC 6: confirming twice, or at the same moment, tells each Attendee once |
| Pre-conditions | As TC-85-02. |
| Test Steps | 1. Confirm it twice at the same moment, then once more. |
| Test Data | — |
| Expected Result | One "has changed" notice per registered Attendee. Confirming an already Confirmed event sends nothing. |

**Automated by:** `tests/unit/event-confirm.test.ts` › "SCRUM-85 [AC6] TC-85-05: …"; `tests/integration/attendee-updates.test.ts` › "… TC-85-02, TC-85-07: …" (two confirmations at once)

### TC-85-06

| Item | Content |
|---|---|
| Test Case ID | TC-85-06 |
| Test Scenario | [Positive, Negative] AC 5, AC 8, AC 10, AC 11: My Registrations while the event is re-planned, and after |
| Pre-conditions | Registered for an event being re-planned whose date has already moved. |
| Test Steps | 1. Open **My Registrations**. <br> 2. Do the same with a withdrawn registration. <br> 3. After the event is Confirmed again, open it once more. |
| Test Data | — |
| Expected Result | Step 1: "Details being updated – registration paused", never "Planning", with the date, time and venues last confirmed, and a link to the event. Step 2: Withdrawn. Step 3: Registered, with the live details and every venue. |

**Automated by:** `tests/unit/replanning-views.test.tsx` › "SCRUM-85 [AC8, AC10] TC-85-06: …", "SCRUM-85 [AC5] TC-85-06: …", "SCRUM-85 [AC11] TC-85-06: …" and "SCRUM-85 [AC8] TC-85-06: only a Planning event that was Confirmed before is being re-planned"; `tests/unit/my-registrations.test.ts` › "SCRUM-162 [AC7], SCRUM-85 [AC8] TC-85-06: …"; `e2e/attendee-updates.spec.ts` › "… TC-85-06 …"

### TC-85-07

| Item | Content |
|---|---|
| Test Case ID | TC-85-07 |
| Test Scenario | [Positive, Negative] AC 9, AC 10: the Attendee view of an event being re-planned |
| Pre-conditions | As TC-85-06. |
| Test Steps | 1. Open the event from My Registrations. <br> 2. Withdraw from it there. <br> 3. Open it as an Attendee not registered, or withdrawn. <br> 4. Browse events. |
| Test Data | — |
| Expected Result | Step 1: its name, description and the date, time and venues last confirmed, "Details being updated – registration paused", and no internal planning information. Step 2: "You've withdrawn from this event." and the Attendee is taken to My Registrations, where it reads Withdrawn, never to a page they can no longer open. Step 3: not found. Step 4: not listed. |

**Automated by:** `tests/unit/replanning-views.test.tsx` › "SCRUM-85 [AC9] TC-85-07: …"; `tests/unit/attendee-events.test.ts` › "SCRUM-85 [AC9, AC10] TC-85-07: …" and "SCRUM-85 [AC5, AC9] TC-85-07: …" (2 tests); `tests/integration/attendee-updates.test.ts` › "… TC-85-07: …"; `e2e/attendee-updates.spec.ts` › "… TC-85-07 …" and "SCRUM-85 [AC9] TC-85-07: withdrawing from the re-planned page takes the Attendee to My Registrations, showing it Withdrawn"

### TC-85-08

| Item | Content |
|---|---|
| Test Case ID | TC-85-08 |
| Test Scenario | [Positive] AC 7: these notices are in the same Notifications list, and open the Attendee view of the event, even while it is re-planned |
| Pre-conditions | A notice about an event that is Confirmed, and one about an event being re-planned. |
| Test Steps | 1. Open Notifications and follow each. |
| Test Data | — |
| Expected Result | Both are in the one list (SCRUM-48) and open `/events/<id>`; the re-planned one only while the Attendee is still registered (withdrawn, or never registered: no link, since they can't open it). A Cancelled or Completed event's notice has no link. |

**Automated by:** `tests/unit/notifications.test.ts` › "SCRUM-85 [AC7, AC9] TC-85-08: …" and "SCRUM-85 [AC5, AC9] TC-85-08: …" (3 tests); `e2e/attendee-updates.spec.ts` › "… TC-85-08 …" (2 tests)

### TC-85-09

| Item | Content |
|---|---|
| Test Case ID | TC-85-09 |
| Test Scenario | [Positive] AC 4, AC 5, AC 12: an event an Attendee is registered for is cancelled |
| Pre-conditions | Registered; another Attendee has withdrawn. |
| Test Steps | 1. As its Coordinator, cancel the event with a reason (SCRUM-82). <br> 2. Open Notifications and My Registrations as each Attendee. |
| Test Data | Reason "Venue flooded." |
| Expected Result | The registered Attendee gets one "An event you registered for was cancelled" notice with the reason, and their registration shows Cancelled. The withdrawn Attendee gets nothing. |

**Automated by:** built with SCRUM-82. `tests/unit/cancel-event.test.ts` › "SCRUM-82 [AC6] TC-82-06: the Organiser, the Coordinator and each Attendee whose registration was cancelled are notified with the reason" (only Registered ones are cancelled, so a withdrawn one isn't told); `tests/integration/close-event.test.ts` › "SCRUM-82 [AC3, AC6] TC-82-04: …"; `tests/unit/my-registrations.test.ts` › "[Positive] AC3: given ConnectSphere cancels the event, a %s registration shows as Cancelled"; `e2e/my-registrations.spec.ts` › "SCRUM-76 [AC3] TC-76-02, SCRUM-85 [AC4, AC5, AC12] TC-85-09: a registration for an event ConnectSphere cancelled shows as Cancelled"
