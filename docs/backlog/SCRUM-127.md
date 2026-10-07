<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-08. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-127 - Choose the event's venue, equipment, layout and facility needs from ConnectSphere's catalogues

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | High |
| **Story points** | 5 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-127 |

---

**User story:** As an Event Organiser, I want to give my venue, equipment and accessibility needs by choosing from ConnectSphere's lists, so that what I ask for can be compared with real venues and stock instead of being retyped from free text.

**Acceptance criteria**

1. Given I fill in the request form (SCRUM-13), I can choose one or more preferred venues from the active venue catalogue, or No preference. Preferred venues are requirements, not bookings.
2. I can list the equipment I need as types from the equipment catalogue, each with a quantity of at least 1, or choose None required.
3. I can choose a layout from the layouts venues support, or No preference, and tick the facilities and accessibility features I need from the lists venues are described with (SCRUM-34), or choose None required. I can add a note for anything the lists don't cover.
4. These choices are required to submit (SCRUM-14); a draft can be saved with them empty (SCRUM-15).
5. Given a request was created before this story, then its free-text venue, equipment and accessibility answers are kept and shown next to the new fields.

**Related:** The Event table already has requiredFacilities and equipmentTypes columns that the form never sets; quantities per equipment type need adding. Carrying these choices into the Coordinator's venue and equipment requests and the readiness checklist is SCRUM-170. Registration needed is SCRUM-171.

**Customer basis:** "Requirements depend on ConnectSphere venues/equipment catalogue." (Event Request Creation) "compulsory fields include name, description, purpose, dates/times, attendance, venue, accessibility, equipment, layout, registration etc." Week 7 change 3: "a conference may require one auditorium for the main programme and three smaller rooms for breakout sessions."

**Why this is a new story:** SCRUM-13 (Sprint 1, Done) asks only that the form's selections reference the catalogues (its AC2), and it stores them as free text: picking from the catalogue adds names to the text. Storing them as choices that search, suitability and the readiness checklist can compare is a new requirement (Week 7 guide, Scenario 2), so it is a new story rather than a reopened SCRUM-13.

**Change log**

* 2026-10-01 (audit): the original "Why" said SCRUM-13 already stores catalogue choices, but the code stores free text. The story now adds the choices themselves (venue, equipment, layout, facilities, accessibility features, registration needed), keeps old free-text answers, fixes the booking's attendance and period to the event, and covers events that don't need registration. Re-estimated from 3 to 5 and renamed.
* 2026-10-07 (Week 7 change 3): AC1 allows several preferred venues. AC7 shows every booked venue. AC8 pre-fills each venue request and lets its attendance be lowered for a room that holds part of the audience (SCRUM-162), so a booking's attendance is no longer fixed to the event's; the combined fit is judged in the safety check (SCRUM-166). Task SCRUM-149, which would have fixed the attendance, is closed.
* 2026-10-07 (backlog refinement): split in three because the story covered three features for two users and touched eight other stories. This story keeps the Organiser's catalogue choices (former AC1–AC3, AC5 and AC6, without registration). Former AC7–AC10 moved to SCRUM-170, and former AC12 is now a Related note there. Former AC4, AC11 and the registration parts of AC5 and AC6 moved to SCRUM-171. Renamed. The three stories are estimated at 5, 3 and 2 points.
* 2026-10-07 (backlog refinement): the Why line names the SCRUM-13 criterion this builds on and why it is new scope rather than a reopened SCRUM-13.

Functionality Area: Event Request Creation
