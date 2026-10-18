# SCRUM-141 — See every event read-only for planning: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-141.md](../backlog/SCRUM-141.md).
Format and conventions: [README.md](README.md). The Lead's role and assignment
are SCRUM-164 and SCRUM-165.

**Shared pre-conditions for every case:** the database is migrated and seeded
and the app is running. "Confirmed — Charity Gala" is Cody's
(`coordinator@test.local`) with Exhibition Hall booked; "Submitted — Alumni
Homecoming" has no Coordinator; "Draft — Annual Tech Summit" is a draft. Cara
is `coordinator2@test.local`, the Lead `lead@test.local`. Every account's
password is `Password123!`.

**Notes:**

- **Venues** are the event's Approved bookings ("Not booked" if none). A
  pending request or a hold isn't a booking yet. Several venues per event
  (SCRUM-162) show as a list with no change here.
- **"Active"** is Under Review, Planning or Confirmed (AC5), the same count the
  Lead's queue shows when assigning (SCRUM-165 AC4).

**What this story doesn't cover yet:**

- **AC3, reassigning:** the Lead's Reassign action is SCRUM-21. Assigning
  (SCRUM-165) is linked from an unassigned event's page.
- **AC4, after a reassignment:** reassigning is SCRUM-21. The rule is already
  in place: any Coordinator can open any event here read-only, and only the
  assigned one can edit it (TC-141-07).

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-141-01](#tc-141-01) | Positive | AC 1 | Unit, e2e |
| [TC-141-02](#tc-141-02) | Positive | AC 2 | Unit, e2e |
| [TC-141-03](#tc-141-03) | Boundary | AC 2 | Unit |
| [TC-141-04](#tc-141-04) | Positive, Negative | AC 2 | Unit, e2e |
| [TC-141-05](#tc-141-05) | Positive, Negative | AC 3 | Unit, e2e |
| [TC-141-06](#tc-141-06) | Positive, Negative | AC 3 | Unit, e2e |
| [TC-141-07](#tc-141-07) | Positive | AC 4 | Unit |
| [TC-141-08](#tc-141-08) | Positive, Negative | AC 5 | Unit, e2e |
| [TC-141-09](#tc-141-09) | Negative | AC 1, AC 6 | Unit, e2e |
| [TC-141-10](#tc-141-10) | Negative | AC 7 | e2e |
| [TC-141-11](#tc-141-11) | Negative | AC 1 | Unit, e2e |

### TC-141-01

| Item | Content |
|---|---|
| Test Case ID | TC-141-01 |
| Test Scenario | [Positive] AC 1: the list shows every event except Drafts, with its details |
| Pre-conditions | Signed in as a Coordinator, Lead, Venue Staff or Technical Support. |
| Test Steps | 1. Click **All Events**. |
| Test Data | — |
| Expected Result | Charity Gala shows its date and time in SGT, status, "Exhibition Hall" and "Cody Coordinator"; Alumni Homecoming shows "Unassigned"; the Draft isn't listed. |

**Automated by:** `tests/unit/all-events.test.ts` › "SCRUM-141 [AC1] TC-141-01: …"; `e2e/all-events.spec.ts` › "SCRUM-141 [AC1, AC2] TC-141-01, TC-141-02: …"

### TC-141-02

| Item | Content |
|---|---|
| Test Case ID | TC-141-02 |
| Test Scenario | [Positive] AC 2: sorted by start date and filtered by status |
| Pre-conditions | Signed in as Venue Staff. |
| Test Steps | 1. Open All Events. <br> 2. Choose Status **Cancelled** and click **Filter**. |
| Test Data | — |
| Expected Result | 1. Soonest start first. 2. Only Cancelled events, e.g. Winter Workshop. A malformed filter in the link is ignored rather than refused. |

**Automated by:** `tests/unit/all-events.test.ts` › "SCRUM-141 [AC2] TC-141-02: …" (3 tests) and "SCRUM-141 [AC1, AC2] TC-141-02: …"; `e2e/all-events.spec.ts` › "… TC-141-02 …" (2 tests)

### TC-141-03

| Item | Content |
|---|---|
| Test Case ID | TC-141-03 |
| Test Scenario | [Boundary] AC 2: a date range covers whole days in Singapore time, both ends included |
| Pre-conditions | — |
| Test Steps | 1. Filter Starts from 1 Jun 2031 to 30 Jun 2031. <br> 2. Use only one end. |
| Test Data | — |
| Expected Result | 1. Events starting from 1 Jun 00:00 SGT up to, not including, 1 Jul 00:00 SGT. 2. Each end works alone. |

**Automated by:** `tests/unit/all-events.test.ts` › "SCRUM-141 [AC2] TC-141-03: …" (2 tests)

### TC-141-04

| Item | Content |
|---|---|
| Test Case ID | TC-141-04 |
| Test Scenario | [Positive, Negative] AC 2: the Lead filters by Coordinator and Unassigned only; nobody else can |
| Pre-conditions | Signed in as the Lead, then as a Coordinator. |
| Test Steps | 1. As the Lead, choose Coordinator Cody. <br> 2. Tick **Unassigned only**. <br> 3. As a Coordinator, open `/all-events?unassigned=1`. |
| Test Data | — |
| Expected Result | 1. Only Cody's events. 2. Only events with no Coordinator, e.g. Alumni Homecoming. 3. The filter is ignored and every event is shown; the Lead's filters aren't offered. |

**Automated by:** `tests/unit/all-events.test.ts` › "SCRUM-141 [AC2] TC-141-04: …" (3 tests); `e2e/all-events.spec.ts` › "… TC-141-04 …"

### TC-141-05

| Item | Content |
|---|---|
| Test Case ID | TC-141-05 |
| Test Scenario | [Positive, Negative] AC 3: an event that isn't mine opens read-only |
| Pre-conditions | Signed in as Cara. |
| Test Steps | 1. Open Charity Gala from All Events. |
| Test Data | — |
| Expected Result | Its details and venues are shown with "Read-only: only the event's assigned Coordinator can change it." and nothing to change. For Cody, its assigned Coordinator, the page links to **Open in my Events**. |

**Automated by:** `tests/unit/all-events.test.ts` › "SCRUM-141 [AC3] TC-141-05: …" (3 tests); `e2e/all-events.spec.ts` › "SCRUM-141 [AC3] TC-141-05: …"

### TC-141-06

| Item | Content |
|---|---|
| Test Case ID | TC-141-06 |
| Test Scenario | [Positive, Negative] AC 3: the Lead's only action here is assigning (reassigning is SCRUM-21) |
| Pre-conditions | Signed in as the Lead. |
| Test Steps | 1. Open Alumni Homecoming. <br> 2. Click **Assign a Coordinator**. <br> 3. Open Charity Gala. |
| Test Data | — |
| Expected Result | 1–2. The link opens the request in the Unassigned queue (SCRUM-165). 3. No assign or edit action. |

**Automated by:** `tests/unit/all-events.test.ts` › "SCRUM-141 [AC3] TC-141-06: …" (2 tests); `e2e/all-events.spec.ts` › "… TC-141-06 …"

### TC-141-07

| Item | Content |
|---|---|
| Test Case ID | TC-141-07 |
| Test Scenario | [Positive] AC 4: a Coordinator an event was reassigned away from can still open it read-only |
| Pre-conditions | The event was Cody's and is now Cara's (SCRUM-21). |
| Test Steps | 1. As Cody, open it from All Events. |
| Test Data | — |
| Expected Result | It opens read-only; Cody can't edit it. |

**Automated by:** `tests/unit/all-events.test.ts` › "SCRUM-141 [AC4] TC-141-07: …"

### TC-141-08

| Item | Content |
|---|---|
| Test Case ID | TC-141-08 |
| Test Scenario | [Positive, Negative] AC 5: the Lead sees each Coordinator's active events and opens their list |
| Pre-conditions | Signed in as the Lead, then as a Coordinator. |
| Test Steps | 1. Open All Events. <br> 2. Click **Cody Coordinator: N active**. <br> 3. As a Coordinator, open All Events. |
| Test Data | — |
| Expected Result | 1. Each Coordinator with their number of Under Review, Planning and Confirmed events. 2. The list filtered to Cody's events. 3. No Coordinator counts. |

**Automated by:** `tests/unit/all-events.test.ts` › "SCRUM-141 [AC5] TC-141-08: …" (2 tests); `e2e/all-events.spec.ts` › "… TC-141-08 …"

### TC-141-09

| Item | Content |
|---|---|
| Test Case ID | TC-141-09 |
| Test Scenario | [Negative] AC 1, AC 6: only Coordinators, the Lead, Venue Staff and Technical Support can open the list or an event in it |
| Pre-conditions | — |
| Test Steps | 1. Sign in as each role and look for **All Events**. <br> 2. As an Organiser, Attendee or Safety Officer, type `/all-events` and `/all-events/<id>`. |
| Test Data | — |
| Expected Result | 1. Only the four roles have it; each still lands on its own first page. 2. "Access denied" and not found; nothing is read. Organisers keep their own list (SCRUM-84). |

**Automated by:** `tests/unit/all-events.test.ts` › "SCRUM-141 [AC6] TC-141-09: …" and "SCRUM-141 [AC1, AC6] TC-141-09: …"; `tests/unit/nav.test.ts` › "SCRUM-141 [AC1, AC6] TC-141-09: …"; `e2e/all-events.spec.ts` › "SCRUM-141 [AC6] TC-141-09: …" (3 tests)

### TC-141-10

| Item | Content |
|---|---|
| Test Case ID | TC-141-10 |
| Test Scenario | [Negative] AC 7: no matching events shows a message, not an empty list |
| Pre-conditions | Signed in as Venue Staff. |
| Test Steps | 1. Filter Completed events starting from 1 Jan 2099. |
| Test Data | — |
| Expected Result | "No events match" with a hint to try other filters; no rows. |

**Automated by:** `e2e/all-events.spec.ts` › "SCRUM-141 [AC2, AC7] TC-141-02, TC-141-10: …"

### TC-141-11

| Item | Content |
|---|---|
| Test Case ID | TC-141-11 |
| Test Scenario | [Negative] AC 1: a draft or a missing id can't be opened here |
| Pre-conditions | Signed in as Venue Staff. |
| Test Steps | 1. Type `/all-events/<draft id>` and `/all-events/missing`. |
| Test Data | — |
| Expected Result | Not found for both, with HTTP 404. |

**Automated by:** `tests/unit/all-events.test.ts` › "SCRUM-141 [AC1] TC-141-11: …"; `e2e/all-events.spec.ts` › "SCRUM-141 [AC1] TC-141-11: a draft or a missing id is a real 404"
