<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-07. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-13 - [Add to Sprint 3] Create an event request

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-13 |

---

_As an Event Organiser_, I want to enter my event's details into a request form, so that ConnectSphere has everything it needs to start planning my event.

_Acceptance Criteria:_

* AC1 (Field scope and capture): The request form allows the Organiser to capture event name, purpose, description, proposed start date/time, proposed end date/time, event timezone, expected attendance, venue requirements, accessibility needs (for example, wheelchair access or mobility seating), equipment requirements, room layout, registration needs, event programme, and special requests.
* **AC2 (Catalogue dependencies):** Venue and equipment needs are chosen from ConnectSphere's catalogues, not typed:

    * Room layout: chosen from the layouts venues support; required.
    * Preferred venues: one or more, chosen from the active venues that support the chosen layout; at least one is required. Changing the layout removes any chosen venue that doesn't support the new layout. Preferred venues are requirements, not bookings.
    * Above these fields, the form lists the active venue catalogue, showing each venue with its capacity and the layouts it supports.
    * Equipment: one line per type from the equipment catalogue (retired types are not offered), each with a quantity of at least 1, and each type listed once; or None required.
    * Facilities and accessibility features: ticked from the lists venues are described with, or None required.
    * The free-text boxes stay as optional notes: Venue requirements (e.g. "If this venue isn't available, another one is fine"), Equipment comments (e.g. "If X isn't available, Y is fine") and an accessibility note.

* AC3 (Optional fields): Event programme/schedule breakdown and special requests/additional notes are optional and are not required to submit the request.
* **AC4 (Mandatory fields):** Event name, description, purpose, proposed start and end dates/times, event timezone, expected attendance, room layout, at least one preferred venue, equipment (or None required), facilities and accessibility features (or None required), and registration needs are mandatory. The venue, equipment and accessibility notes are optional. If any mandatory field is empty, submission is blocked and inline validation errors identify the missing fields.
* AC5 (Draft saving): The Organiser can save an incomplete request as a draft even when mandatory submission fields are missing. Draft saving and state persistence are governed by SCRUM-15.
* AC6 (Timezone and storage): The selected event timezone is used to display and interpret event dates and times. Stored date-time values are converted consistently to UTC.

* AC7 (Attendance): If the Organiser attempts to submit an expected attendance of zero or a negative number, submission is blocked and the system states that attendance must be a positive whole number.
* AC8 (Date range): If the Organiser attempts to submit an end date/time that is earlier than or equal to the start date/time, submission is blocked and the date/time range is reported as invalid.
* AC9 (Past dates): If the Organiser attempts to submit a proposed start date/time in the past relative to system time, submission is blocked and the date/time is reported as invalid.
* AC10 (Review step): When all mandatory fields pass validation and the Organiser proceeds to submit, the system displays a structured summary of all entered details for review before final submission.
* AC11 (Text input): Event name, description, and special requests have defined maximum character limits and are sanitised to prevent script injection.
* **AC12 (Earlier requests):** Requests created before the catalogue choices existed keep their free-text venue, equipment and accessibility answers, shown next to the new fields. A draft among them must have the choices filled in before it can be submitted (AC4).
* **AC13 (Detail view):** The event's detail view shows the same fields for every request. Under Venue: the layout, the preferred venues, Required facilities, accessibility features and the venue note. Under Equipment: each type with its quantity, and the equipment comments. A choice left empty shows "None required" and an empty note shows "—"; no field is hidden. Earlier requests show their free-text answers in the same places (AC12).

_Note:_ SCRUM-13 owns the form and field-level input behaviour. SCRUM-15 owns draft persistence. SCRUM-14 owns the final submission gate. Event timezone is a required event attribute because lifecycle time comparisons must be unambiguous.


**Design and test impact:** Data model: the event stores its preferred venues, and each equipment type with a quantity (update docs/data-model.md, the class diagram and the ERD). Tests: validation of the choices (unit), creating and submitting a request with choices (E2E), and regression for drafts (SCRUM-15), submission (SCRUM-14), the review summary (AC10) and earlier requests (AC12).

**Change log**

* 2026-10-07 (reopened for Sprint 3): AC2 was not met. The form stores venue and equipment needs as free text, and choosing from the catalogue only appends venue names to that text, so search, suitability, the readiness checklist and the Coordinator's forms can't use them. This is the original criterion, not new scope (Week 7 guide, Scenario 1). AC2 now states what choosing from the catalogue means, AC4 lists the mandatory choices, and AC12 and AC13 are added; these moved from SCRUM-127 (its former AC1–AC3, AC5, AC6 and AC13). Original estimate 2 SP (Sprint 1); remaining work 3 SP.
