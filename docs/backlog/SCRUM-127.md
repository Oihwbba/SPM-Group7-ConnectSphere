<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-127 - Capture the Organiser's venue, equipment and registration needs as choices and carry them into planning

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Medium |
| **Story points** | 5 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-127 |

---

**User story:** As an Event Organiser, I want to give my venue, equipment, accessibility and registration needs by choosing from ConnectSphere's lists, and as an Event Coordinator I want those choices carried into planning, so that what was asked for is booked without retyping and nothing requested is forgotten.

**Acceptance criteria**

1. Given I fill in the request form (SCRUM-13), I can choose a preferred venue from the active venue catalogue, or No preference. The preferred venue is a requirement, not a booking.
2. I can list the equipment I need as types from the equipment catalogue, each with a quantity of at least 1, or choose None required.
3. I can choose a layout from the layouts venues support, or No preference, and tick the facilities and accessibility features I need from the lists venues are described with (SCRUM-34), or choose None required. I can add a note for anything the lists don't cover.
4. I choose Registration needed: Yes or No, and can add a note about registration.
5. These choices are required to submit (SCRUM-14); a draft can be saved with them empty (SCRUM-15).
6. Given a request was created before this story, then its free-text venue, equipment, accessibility and registration answers are kept and shown next to the new fields.
7. Given a venue booking is Approved (SCRUM-53), then event pages show the Booked venue. If it differs from the preferred venue, the Coordinator and Organiser see both; Attendees see only the booked venue.
8. Given the Coordinator requests a venue for the event (SCRUM-50), then the form is pre-filled with the preferred venue (if any), the event's period, its expected attendance, and the facilities and layout chosen here. The attendance can't be changed, and the requested period must cover the event's whole period.
9. Given the Organiser listed equipment, when the Coordinator creates the equipment request (SCRUM-27), then it is pre-filled with those types and quantities, which the Coordinator can adjust before submitting.
10. Given the Organiser listed equipment and no equipment request exists yet, then the readiness checklist (SCRUM-110) shows Equipment as Not requested yet and incomplete. Given the Organiser chose None required, then Equipment appears on the checklist only if the Coordinator creates an equipment request.
11. Given Registration needed is No, then confirming the event (SCRUM-81) doesn't open registration, and the event isn't listed to Attendees (SCRUM-72).
12. Venue search and suitability (SCRUM-38, SCRUM-40) read these choices. In the impactful-field rule (SCRUM-26, SCRUM-128), "venue" and "equipment" mean these choices.

**Related:** the Event table already has requiredFacilities, equipmentTypes and registrationRequired columns that the form never sets; quantities per equipment type need adding.

**Customer basis:** "Requirements depend on ConnectSphere venues/equipment catalogue." (Event Request Creation) "compulsory fields include name, description, purpose, dates/times, attendance, venue, accessibility, equipment, layout, registration etc." Step 11: "Where registration is required, Attendees can register for the confirmed event during the permitted registration period and subject to the applicable capacity." "Venue and technical arrangements are mandatory before confirmation." (Step 8)

**Why this is a new story:** SCRUM-13 (Sprint 1, Done) stores the Organiser's venue, equipment, accessibility and registration needs as free text; picking from the catalogue only adds names to the text. Search, suitability and the readiness checklist can't compare free text, and nothing records whether an event needs registration. Separately, the booking form lets the Coordinator change the attendance (SCRUM-50), so a venue could be booked for fewer people than the event expects and still satisfy the checklist.

**Change log**

* 2026-10-01 (audit): the original "Why" said SCRUM-13 already stores catalogue choices, but the code stores free text. The story now adds the choices themselves (venue, equipment, layout, facilities, accessibility features, registration needed), keeps old free-text answers, fixes the booking's attendance and period to the event, and covers events that don't need registration. Re-estimated from 3 to 5 and renamed.

Functionality Area: Event Request Creation, Venue Booking Request, Equipment Request Management
