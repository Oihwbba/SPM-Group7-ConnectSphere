# SCRUM-40 — Flag venue suitability, with the reason

Test cases for [docs/backlog/SCRUM-40.md](../backlog/SCRUM-40.md). Format:
[README](README.md). Seeded accounts share the password `Password123!`.

The automatic result compares a venue with what the booking request asks
for: its attendance, facilities, accessibility features and layout, as the
Coordinator enters them on the request form. Search (SCRUM-38) compares it
with what is entered in the search before a request exists. Venue search
isn't built yet, so those cases (AC1–AC4 and AC7 in search results) are
written with SCRUM-38; `assessSuitability` in `lib/venue-suitability.ts`
takes the search's values the same way.

### TC-40-01

| Item | Content |
|---|---|
| Test Case ID | TC-40-01 |
| Test Scenario | [Negative] [Boundary] AC 1: attendance over capacity is Not suitable; equal to it is not |
| Pre-conditions | A venue holding 100. |
| Test Steps | 1. Assess it for attendance 101. <br> 2. Assess it for attendance 100. |
| Test Data | 101, 100 |
| Expected Result | 101 is Not suitable with "Capacity 100 < attendance 101". 100 is Suitable with no reasons. |

**Automated by:** `tests/unit/venue-suitability.test.ts` › "SCRUM-40 [AC1] TC-40-01: …"

### TC-40-02

| Item | Content |
|---|---|
| Test Case ID | TC-40-02 |
| Test Scenario | [Negative] AC 2: a facility the request needs that the venue lacks is Not suitable |
| Pre-conditions | Signed in as Coordinator, assigned to a Planning event; Seminar Room 2.1 has a projector and a whiteboard. |
| Test Steps | 1. Open Request Venue, choose the event and Seminar Room 2.1. <br> 2. Tick "stage". |
| Test Data | `coordinator@test.local` |
| Expected Result | Not suitable, with "Missing facility: stage". Facilities match as tags: "Sound System" matches "sound-system". |

**Automated by:** `tests/unit/venue-suitability.test.ts` › "SCRUM-40 [AC2] TC-40-02: …"; `e2e/venue-suitability.spec.ts` › "SCRUM-40 [AC2, AC3, AC6, AC8, AC9, AC10] …"

### TC-40-03

| Item | Content |
|---|---|
| Test Case ID | TC-40-03 |
| Test Scenario | [Negative] AC 3: an accessibility feature the venue doesn't provide is Not suitable |
| Pre-conditions | A venue with a hearing loop and no wheelchair access. |
| Test Steps | 1. Ask for wheelchair access on the request. |
| Test Data | — |
| Expected Result | Not suitable, with "No wheelchair access; event needs wheelchair access". The request stores the accessibility features asked for. |

**Automated by:** `tests/unit/venue-suitability.test.ts` › "SCRUM-40 [AC3] TC-40-03: …"; `tests/integration/venue-suitability.test.ts` › "SCRUM-40 [AC9, AC10] TC-40-10, TC-40-11: …"

### TC-40-04

| Item | Content |
|---|---|
| Test Case ID | TC-40-04 |
| Test Scenario | [Negative] AC 4: a layout the venue doesn't support is Not suitable |
| Pre-conditions | A venue supporting theatre and classroom. |
| Test Steps | 1. Ask for banquet. <br> 2. Ask for "Classroom". |
| Test Data | — |
| Expected Result | Banquet is Not suitable with "Banquet layout not supported"; "Classroom" is Suitable (compared as a tag). |

**Automated by:** `tests/unit/venue-suitability.test.ts` › "SCRUM-40 [AC4] TC-40-04: …"

Not reachable in the browser yet. The request form asks for the layout first
and then offers only venues that support it (SCRUM-50), so a request can't
pair a venue with a layout it doesn't support. The browser case comes with
venue search (SCRUM-38), where the layout entered in the search is compared
with every venue.

### TC-40-05

| Item | Content |
|---|---|
| Test Case ID | TC-40-05 |
| Test Scenario | [Positive] AC 5: a venue that meets everything is Suitable, with no reasons |
| Pre-conditions | As TC-40-02. |
| Test Steps | 1. Tick only "projector". |
| Test Data | — |
| Expected Result | Suitable; no reasons are listed. |

**Automated by:** `tests/unit/venue-suitability.test.ts` › "SCRUM-40 [AC5] TC-40-05: …"; `tests/unit/suitability-panel.test.tsx` › "SCRUM-40 [AC5] TC-40-05: …"; `e2e/venue-suitability.spec.ts`

### TC-40-06

| Item | Content |
|---|---|
| Test Case ID | TC-40-06 |
| Test Scenario | [Positive] AC 6: every reason that applies is listed, naming both values |
| Pre-conditions | A venue holding 100 with no livestream, stage or wheelchair access, and no banquet layout. |
| Test Steps | 1. Ask for 150 people, livestream, stage, wheelchair access and banquet. |
| Test Data | — |
| Expected Result | "Capacity 100 < attendance 150", "Missing facility: livestream", "Missing facility: stage", "No wheelchair access; event needs wheelchair access", "Banquet layout not supported". |

**Automated by:** `tests/unit/venue-suitability.test.ts` › "SCRUM-40 [AC6] TC-40-06: …"; `tests/unit/suitability-panel.test.tsx` › "SCRUM-40 [AC6] TC-40-06: …"

### TC-40-07

| Item | Content |
|---|---|
| Test Case ID | TC-40-07 |
| Test Scenario | [Negative] AC 7: the venue detail view shows no suitability |
| Pre-conditions | Signed in as Coordinator. |
| Test Steps | 1. Open the Executive Boardroom's page in the catalogue. |
| Test Data | — |
| Expected Result | No Suitable or Not suitable indicator, because there is no event to compare against. The indicator in search results is TC-38's. |

**Automated by:** Manual until SCRUM-34 adds the venue detail page; its e2e test "SCRUM-40 [AC7] TC-40-07: …" is added with that page (it is on `SCRUM-34-venue-catalogue`'s stacked SCRUM-40 branch). Until then there is no detail view to show an indicator on.

### TC-40-08

| Item | Content |
|---|---|
| Test Case ID | TC-40-08 |
| Test Scenario | [Positive] AC 8: the assigned Coordinator records a judgement with a note; it counts for this event |
| Pre-conditions | As TC-40-02, the venue showing Not suitable. |
| Test Steps | 1. Choose Record your judgement, pick Suitable, write a note, save. <br> 2. Record Not suitable for the same event and venue. |
| Test Data | Note "We bring our own portable stage." |
| Expected Result | The judgement shows next to the automatic result, which still shows Not suitable, with "This is the result that counts for this event." Recording again replaces it: one judgement per event and venue. An audit entry records each. |

**Automated by:** `tests/unit/suitability-judgement.test.ts` › "SCRUM-40 [AC8] TC-40-08: …"; `tests/unit/venue-suitability.test.ts` › "SCRUM-40 [AC8] TC-40-08: …"; `tests/integration/venue-suitability.test.ts` › "SCRUM-40 [AC8] TC-40-08: …"; `e2e/venue-suitability.spec.ts`

### TC-40-09

| Item | Content |
|---|---|
| Test Case ID | TC-40-09 |
| Test Scenario | [Negative] AC 8: only the assigned Coordinator, with a note, while the event is being planned |
| Pre-conditions | Various. |
| Test Steps | 1. Save a judgement without a note, and without choosing either option. <br> 2. As another Coordinator, or for an unassigned event, record one. <br> 3. Record one for an Under Review, Confirmed or Cancelled event, or a retired venue. <br> 4. As any other role, record one. |
| Test Data | — |
| Expected Result | 1: "Add a note explaining your judgement." / "Choose Suitable or Not suitable."; the database also refuses a blank note. 2: "Event not found.", the same as for a missing event. 3: "Suitability can only be judged while the event is being planned." / "Venue not found." 4: "You do not have permission to do that." Nothing is written in any case, and only the assigned Coordinator is offered the button. |

**Automated by:** `tests/unit/suitability-judgement.test.ts` › "SCRUM-40 [AC8] TC-40-09: …"; `tests/unit/suitability-panel.test.tsx` › "SCRUM-40 [AC8] TC-40-09: …"; `tests/integration/venue-suitability.test.ts` › "SCRUM-40 [AC8] TC-40-09: …"; `e2e/venue-suitability.spec.ts`

### TC-40-10

| Item | Content |
|---|---|
| Test Case ID | TC-40-10 |
| Test Scenario | [Positive] [Negative] AC 9: the judgement is advisory |
| Pre-conditions | A Planning event. |
| Test Steps | 1. Judge a venue Not suitable, then request it. <br> 2. Judge a venue holding 200 Suitable for an event of 300, then request it. |
| Test Data | — |
| Expected Result | 1 is requested. 2 is refused for capacity whatever the judgement says, and nothing is written. Confirmation (SCRUM-110) never reads the judgement. |

**Automated by:** `tests/integration/venue-suitability.test.ts` › "SCRUM-40 [AC9, AC10] …" and "SCRUM-40 [AC9] TC-40-10: …"; `e2e/venue-suitability.spec.ts`

### TC-40-11

| Item | Content |
|---|---|
| Test Case ID | TC-40-11 |
| Test Scenario | [Positive] AC 10: Venue Staff see the judgement and note on the request |
| Pre-conditions | A pending request whose Coordinator recorded a judgement. |
| Test Steps | 1. Sign in as Venue Staff and open Bookings. |
| Test Data | `venuestaff@test.local` |
| Expected Result | The request shows the Coordinator's judgement, its note, who recorded it and when; a request without one says "None recorded". The accessibility features asked for are shown against the venue's. |

**Automated by:** `tests/unit/suitability-panel.test.tsx` › "SCRUM-40 [AC10] TC-40-11: …"; `tests/integration/venue-suitability.test.ts`; `e2e/venue-suitability.spec.ts`
