<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-08. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-170 - Carry the Organiser's catalogue choices into planning

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | High |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-170 |

---

**User story:** As an Event Coordinator, I want the venues, layout, facilities and equipment the Organiser chose on the request form (SCRUM-127) carried into my venue requests, equipment request and readiness checklist, so that what was asked for is booked without retyping and nothing requested is forgotten.

**Acceptance criteria**

1. Given venue bookings are Approved (SCRUM-53), then event pages show the booked venues. If they differ from the preferred venues, the Coordinator and Organiser see both; Attendees see only the booked venues.
2. Given the Coordinator requests a venue for the event (SCRUM-50, SCRUM-162), then the form is pre-filled with a preferred venue not yet requested (if any), the event's period, its expected attendance, and the facilities and layout chosen in SCRUM-127. The requested period must cover the event's whole period. The attendance can be lowered, to no less than 1, for a venue that holds only part of the audience.
3. Given the Organiser listed equipment, when the Coordinator creates the equipment request (SCRUM-27), then it is pre-filled with those types and quantities, which the Coordinator can adjust before submitting.
4. Given the Organiser listed equipment and no equipment request exists yet, then the readiness checklist (SCRUM-110) shows Equipment as Not requested yet and incomplete. Given the Organiser chose None required, then Equipment appears on the checklist only if the Coordinator creates an equipment request.

**Depends on:** SCRUM-127, which adds the choices to the request form. The parts of AC1 and AC2 that cover several venues need SCRUM-162.

**Related:** Venue search and suitability (SCRUM-38, SCRUM-40) read the choices from SCRUM-127. In the impactful-field rule (SCRUM-26, SCRUM-128), "venue" and "equipment" mean these choices.

**Customer basis:** "Venue and technical arrangements are mandatory before confirmation." (Step 8) Week 7 change 3: "a conference may require one auditorium for the main programme and three smaller rooms for breakout sessions."

**Why this is a new story:** SCRUM-50, SCRUM-27 and SCRUM-110 (Sprint 2, Done) don't read the Organiser's needs, so the Coordinator retypes them and the checklist can't tell that equipment was asked for. Separately, nothing checked that the venues booked fit the whole audience; after Week 7 that combined fit is judged in the safety check (SCRUM-166).

**Change log**

* 2026-10-07 (backlog refinement): split from SCRUM-127, which was too big for one sprint. AC1–AC4 are SCRUM-127's former AC7–AC10, unchanged. SCRUM-127's former AC12 is now the Related note, because only SCRUM-38, SCRUM-40, SCRUM-26 and SCRUM-128 can test it.

Functionality Area: Venue Booking Request, Equipment Request Management
