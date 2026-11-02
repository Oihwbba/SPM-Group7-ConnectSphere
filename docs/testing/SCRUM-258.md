# SCRUM-258 — A Confirmed event's flagged arrangements read as secured: test cases

SCRUM-258 is a bug task in Jira. It finishes SCRUM-131 AC3 on the event page: a
Confirmed event with a flagged booking or reservation said its arrangements
were secured and showed no warning, while the Changes tab listed the flag.

Format and conventions: [README.md](README.md).

**Shared pre-conditions:** a Confirmed event with `usr_organiser` as its
Organiser and `usr_coordinator` as its Coordinator. The unit cases mock the
database; the integration and e2e cases write their own events to a local
database.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-258-01](#tc-258-01) | Positive | AC 1 | Unit |
| [TC-258-02](#tc-258-02) | Positive | AC 1 | Unit |
| [TC-258-03](#tc-258-03) | Boundary | AC 1 | Unit |
| [TC-258-04](#tc-258-04) | Negative | AC 1 | Unit |
| [TC-258-05](#tc-258-05) | Positive, Negative | AC 2 | Unit |
| [TC-258-06](#tc-258-06) | Negative | AC 3 | Unit |
| [TC-258-07](#tc-258-07) | Positive, Negative, Boundary | AC 2, AC 3 | Unit |
| [TC-258-08](#tc-258-08) | Positive | AC 1 | Integration |
| [TC-258-09](#tc-258-09) | Positive, Negative | AC 1, AC 2, AC 3 | e2e |
| [TC-258-10](#tc-258-10) | Negative | AC 3 | e2e |
| [TC-258-11](#tc-258-11) | Negative | AC 3 | e2e |

---

### TC-258-01

| Item | Content |
|---|---|
| Test Case ID | TC-258-01 |
| Test Scenario | [Positive] AC 1: the Organiser's banner waits on the Coordinator and opens on Changes |
| Pre-conditions | Viewer is the Organiser; one unresolved flag. |
| Test Steps | 1. Work out the next step with a named Coordinator. <br> 2. Work out the tab that opens first. <br> 3. Work out the next step with no Coordinator's name. |
| Test Data | Coordinator "Cody Coordinator" |
| Expected Result | 1. "Waiting for Cody Coordinator to decide what happens to the flagged arrangements", as a waiting step. 2. Changes. 3. "Waiting for the Coordinator to decide what happens to the flagged arrangements". |

**Automated by:** `tests/unit/event-next-step.test.ts` › "SCRUM-258 [AC1] TC-258-01: the Organiser waits on the Coordinator by name, or as the Coordinator, and the page opens on Changes"

### TC-258-02

| Item | Content |
|---|---|
| Test Case ID | TC-258-02 |
| Test Scenario | [Positive] AC 1: the Coordinator's banner still asks them to decide |
| Pre-conditions | Viewer is the assigned Coordinator; one unresolved flag. |
| Test Steps | 1. Work out the next step. |
| Test Data | — |
| Expected Result | 1. "Your turn: decide what happens to the flagged arrangements", as the viewer's step, on Changes. |

**Automated by:** `tests/unit/event-next-step.test.ts` › "SCRUM-258 [AC1] TC-258-02: the Coordinator is still asked to decide"

### TC-258-03

| Item | Content |
|---|---|
| Test Case ID | TC-258-03 |
| Test Scenario | [Boundary] AC 1: a flag and a pending change request at once |
| Pre-conditions | Viewer is the Organiser; one unresolved flag and one pending change request. |
| Test Steps | 1. Work out the next step. |
| Test Data | — |
| Expected Result | 1. The flag's waiting text from TC-258-01, not the change request's. |

**Automated by:** `tests/unit/event-next-step.test.ts` › "SCRUM-258 [AC1] TC-258-03: the flag comes before the Organiser's pending change request"

### TC-258-04

| Item | Content |
|---|---|
| Test Case ID | TC-258-04 |
| Test Scenario | [Negative] AC 1: no unresolved flag, so nothing changes |
| Pre-conditions | Viewer is the Organiser; no unresolved flag. |
| Test Steps | 1. Work out the next step. |
| Test Data | — |
| Expected Result | 1. "Confirmed: the arrangements are secured. Nothing is waiting before the event.", on Arrangements. |

**Automated by:** `tests/unit/event-next-step.test.ts` › "SCRUM-258 [AC1] TC-258-04: with no flag left, the event reads as secured again"

### TC-258-05

| Item | Content |
|---|---|
| Test Case ID | TC-258-05 |
| Test Scenario | [Positive, Negative] AC 2: a flagged reservation stays listed, apart from unflagged ones |
| Pre-conditions | Reserved: 1 Projector unflagged, 2 and 1 Projectors flagged, a Lectern flagged for another period, a Laptop unflagged for another period. |
| Test Steps | 1. Read the confirmed arrangements. |
| Test Data | — |
| Expected Result | 1. Equipment lists "Projector × 1"; flagged equipment lists "Projector × 3" and "Lectern × 1"; the Laptop isn't listed. |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-258 [AC2] TC-258-05: a flagged reservation stays listed apart, even once it no longer covers the event; an unflagged one that doesn't cover it is still left out"

### TC-258-06

| Item | Content |
|---|---|
| Test Case ID | TC-258-06 |
| Test Scenario | [Negative] AC 3: a cancelled reservation shows no badge, and the panel's data holds no flag reason |
| Pre-conditions | A cancelled reservation with its flag still set; a Lectern reservation flagged with a reason. |
| Test Steps | 1. Read the confirmed arrangements. |
| Test Data | Reason "One projector is damaged." |
| Expected Result | 1. Flagged equipment lists only "Lectern × 1", and the result doesn't contain the reason. |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-258 [AC3] TC-258-06: a cancelled reservation is neither listed nor flagged, and no flag reason is returned"

### TC-258-07

| Item | Content |
|---|---|
| Test Case ID | TC-258-07 |
| Test Scenario | [Positive, Negative, Boundary] AC 2, AC 3: only a live booking reads as flagged |
| Pre-conditions | One booking with its flag set, in each status below. |
| Test Steps | 1. Read the event's bookings at the given time. |
| Test Data | Pending, Approved, Held expiring 1 ms after now, Held expiring exactly now, Rejected, Cancelled, Expired |
| Expected Result | 1. Flagged: Pending, Approved and the hold not yet expired. Not flagged: the rest. No booking carries a reason. |

**Automated by:** `tests/unit/event-readiness.test.ts` › "SCRUM-258 [AC2, AC3] TC-258-07: a flagged $status booking with hold expiry $holdExpiresAt reads as flagged: $flagged, with no reason"

### TC-258-08

| Item | Content |
|---|---|
| Test Case ID | TC-258-08 |
| Test Scenario | [Positive] AC 1: the page's data counts a flag for the Organiser's banner too |
| Pre-conditions | A Confirmed event whose only flag is on a reservation. |
| Test Steps | 1. Read the page as the Organiser. <br> 2. Read it as the Coordinator. |
| Test Data | — |
| Expected Result | 1. The waiting step from TC-258-01, on Changes, with nothing counted for action. 2. The Coordinator's step from TC-258-02, with one flag counted. |

**Automated by:** `tests/integration/event-page-data.test.ts` › "SCRUM-258 [AC1] TC-258-08: a flagged reservation on a Confirmed event has the Organiser waiting on the Coordinator, on Changes, and the Coordinator asked to decide"

### TC-258-09

| Item | Content |
|---|---|
| Test Case ID | TC-258-09 |
| Test Scenario | [Positive, Negative] AC 1, AC 2, AC 3: the journey on the event page |
| Pre-conditions | A Confirmed event with a flagged Approved booking at Exhibition Hall, 2 Projectors flagged and 1 Wireless Microphone unflagged. |
| Test Steps | 1. Sign in as the Organiser and open the event. <br> 2. Open Arrangements. <br> 3. Sign in as the Coordinator and open the event. |
| Test Data | `organiser@test.local`, `coordinator@test.local` |
| Expected Result | 1. The banner waits on the Coordinator, doesn't say secured, and Changes is open. 2. The booking reads Exhibition Hall, Approved, with the badge beside it; the equipment lists both items with one badge, not on the Wireless Microphone; neither flag reason shows. 3. The banner asks the Coordinator to decide. |

**Automated by:** `e2e/reconsideration.spec.ts` › "SCRUM-258 [AC1, AC2, AC3] TC-258-09: on a Confirmed event the banner doesn't call flagged arrangements secured, and Confirmed arrangements badges them without the reason"

### TC-258-10

| Item | Content |
|---|---|
| Test Case ID | TC-258-10 |
| Test Scenario | [Negative] AC 3: once resolved, an arrangement shows no badge, without reloading the page |
| Pre-conditions | Signed in as the Coordinator; a Confirmed event with a flagged Approved booking at Exhibition Hall; Arrangements already opened, so the panel is mounted. |
| Test Steps | 1. Open Changes and choose Still stands. <br> 2. Open Arrangements. |
| Test Data | `coordinator@test.local` |
| Expected Result | 1. "Exhibition Hall (Approved) still stands." 2. The booking is still listed, with no badge, and the banner says the arrangements are secured. |

**Automated by:** `e2e/reconsideration.spec.ts` › "SCRUM-258 [AC3] TC-258-10: resolving a flag clears its badge from Confirmed arrangements without reloading the page"

### TC-258-11

| Item | Content |
|---|---|
| Test Case ID | TC-258-11 |
| Test Scenario | [Negative] AC 3: a flag resolved by someone else clears from a page already open |
| Pre-conditions | Signed in as the Organiser, with Arrangements open on a Confirmed event with a flagged booking. |
| Test Steps | 1. Clear the flag in the database. <br> 2. Wait for the page's own refresh. |
| Test Data | `organiser@test.local` |
| Expected Result | 2. The badge goes, without reloading the page. |

**Automated by:** `e2e/reconsideration.spec.ts` › "SCRUM-258 [AC3] TC-258-11: a flag resolved by someone else clears from the Organiser's open page"
