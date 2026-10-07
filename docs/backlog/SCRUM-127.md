<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-07. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-127 - Carry the Organiser's choices into planning and record whether registration is needed

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Medium |
| **Story points** | 5 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-127 |

---

**User story:** As an Event Coordinator, I want the layout, venues, facilities and equipment the Organiser chose on the request form (SCRUM-13) carried into my venue requests, equipment request and readiness checklist, and as an Event Organiser I want to say whether my event needs registration, so that what was asked for is booked without retyping, nothing requested is forgotten, and Attendees only see events they can register for.

**Acceptance criteria**

1. On the request form (SCRUM-13), I choose Registration needed: Yes or No, and can add a note about registration. It is required to submit (SCRUM-14); a draft can be saved without it (SCRUM-15). Requests created before this story keep their registration notes, shown next to the new field.
2. Given Registration needed is No, then confirming the event (SCRUM-81) doesn't open registration, and the event isn't listed to Attendees (SCRUM-72).
3. Given venue bookings are Approved (SCRUM-53), if the booked venues differ from the preferred venues, then the Coordinator and Organiser see both; Attendees see only the booked venues.
4. Given the Coordinator requests a venue for the event (SCRUM-50, SCRUM-162), then the form is pre-filled with a preferred venue not yet requested (if any) and the layout and facilities the Organiser chose, and the Organiser's venue note is shown alongside. The period and attendance follow SCRUM-162 AC4.
5. Given the Organiser listed equipment, when the Coordinator creates the equipment request (SCRUM-27), then it is pre-filled with those types and quantities, which the Coordinator can adjust before submitting, and the Organiser's equipment comments are shown alongside.
6. Given the Organiser listed equipment and no equipment request exists yet, then the readiness checklist (SCRUM-110) shows Equipment as Not requested yet and incomplete. Given the Organiser chose None required, then Equipment appears on the checklist only if the Coordinator creates an equipment request.
7. Venue search and suitability (SCRUM-38, SCRUM-40) read the Organiser's choices. In the impactful-field rule (SCRUM-26, SCRUM-128), "venue" and "equipment" mean these choices.

**Depends on:** SCRUM-13 (reopened), which adds the choices to the request form.

**Customer basis:** "Requirements depend on ConnectSphere venues/equipment catalogue." (Event Request Creation) Step 11: "Where registration is required, Attendees can register for the confirmed event during the permitted registration period and subject to the applicable capacity." "Venue and technical arrangements are mandatory before confirmation." (Step 8) Week 7 change 3: "a conference may require one auditorium for the main programme and three smaller rooms for breakout sessions."

**Why this is a new story:** Choosing the layout, venues, equipment and facilities from the catalogue was already required by SCRUM-13 AC2 and was missed, so that work is done by reopening SCRUM-13 (Week 7 guide, Scenario 1). What stays here is new (Scenario 2): no Done story asked for the Organiser's choices to pre-fill the Coordinator's venue and equipment requests (SCRUM-50, SCRUM-27) or to appear on the readiness checklist (SCRUM-110), and nothing recorded whether an event needs registration (SCRUM-72, SCRUM-81).

**Design and test impact:** Sequence diagram for the Coordinator's venue and equipment requests being pre-filled from the event. Data model: Registration needed is stored on the event. Regression tests for SCRUM-27, SCRUM-50, SCRUM-72, SCRUM-81 and SCRUM-110 must still pass.

**Change log**

* 2026-10-01 (audit): the original "Why" said SCRUM-13 already stores catalogue choices, but the code stores free text. The story now adds the choices themselves (venue, equipment, layout, facilities, accessibility features, registration needed), keeps old free-text answers, fixes the booking's attendance and period to the event, and covers events that don't need registration. Re-estimated from 3 to 5 and renamed.
* 2026-10-07 (Week 7 change 3): AC1 allows several preferred venues. AC7 shows every booked venue. AC8 pre-fills each venue request and lets its attendance be lowered for a room that holds part of the audience (SCRUM-162), so a booking's attendance is no longer fixed to the event's; the combined fit is judged in the safety check (SCRUM-166). Task SCRUM-149, which would have fixed the attendance, is closed.
* 2026-10-07 (PO UI review): AC1 makes the room layout required and chosen first, makes at least one preferred venue required (No preference removed) and offers only venues that support the chosen layout; the form lists each venue with the layouts it supports, and the Venue requirements text becomes an optional note. AC2 adds an optional equipment comments box. AC3 no longer covers the layout (moved to AC1). AC5 now lists what submission requires. AC13 added: the detail view shows the same fields for every request, including Required facilities.
* 2026-10-07 (split, Week 7 guide): the form-capture criteria (former AC1–AC3, AC5, AC6 and AC13) moved to SCRUM-13, which is reopened because its AC2 already required catalogue choices (Scenario 1). This story keeps the new requirements: former AC4 and AC11 are now AC1–AC2, AC7 is AC3, AC8 is AC4 (period and attendance now left to SCRUM-162 AC4, which says the same), AC9 is AC5, AC10 is AC6 and AC12 is AC7. AC4 and AC5 now show the Organiser's notes alongside the pre-filled forms. Renamed; re-estimated after the split at 5 SP.
