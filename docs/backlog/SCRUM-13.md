<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-29. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-13 - Create an event request

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-13 |

---

**Superseded in part** (the criteria below are kept as accepted in Sprint 1):

* **AC1, AC4 and AC6, superseded by SCRUM-129 AC1:** every event is in Singapore time and the form has no timezone selector; times are still stored as UTC (SCRUM-129 AC4).
* **AC1, superseded by SCRUM-190 AC1:** the separate proposed start and end date/time become one date with a start and an end time.
* **AC8, extended by SCRUM-190 AC2:** an event starts and ends within one Singapore day.
* **AC1 and AC4, superseded by SCRUM-171 AC1 and AC2:** instead of free-text registration needs, the Organiser chooses Registration needed: Yes or No, which is required to submit, and can add a note about registration.

_As an Event Organiser_, I want to enter my event's details into a request form, so that ConnectSphere has everything it needs to start planning my event.

_Acceptance Criteria:_

* AC1 (Field scope and capture): The request form allows the Organiser to capture event name, purpose, description, proposed start date/time, proposed end date/time, event timezone, expected attendance, venue requirements, accessibility needs (for example, wheelchair access or mobility seating), equipment requirements, room layout, registration needs, event programme, and special requests.
* AC2 (Catalogue dependencies): Venue and equipment selections within the form reference ConnectSphere’s venue and equipment catalogues.
* AC3 (Optional fields): Event programme/schedule breakdown and special requests/additional notes are optional and are not required to submit the request.
* AC4 (Mandatory fields): Event name, description, purpose, proposed start and end dates/times, event timezone, expected attendance, venue requirements, accessibility needs, equipment requirements, room layout, and registration needs are mandatory. If any mandatory field is empty, submission is blocked and inline validation errors identify the missing fields.
* AC5 (Draft saving): The Organiser can save an incomplete request as a draft even when mandatory submission fields are missing. Draft saving and state persistence are governed by SCRUM-15.
* AC6 (Timezone and storage): The selected event timezone is used to display and interpret event dates and times. Stored date-time values are converted consistently to UTC.
* AC7 (Attendance): If the Organiser attempts to submit an expected attendance of zero or a negative number, submission is blocked and the system states that attendance must be a positive whole number.
* AC8 (Date range): If the Organiser attempts to submit an end date/time that is earlier than or equal to the start date/time, submission is blocked and the date/time range is reported as invalid.
* AC9 (Past dates): If the Organiser attempts to submit a proposed start date/time in the past relative to system time, submission is blocked and the date/time is reported as invalid.
* AC10 (Review step): When all mandatory fields pass validation and the Organiser proceeds to submit, the system displays a structured summary of all entered details for review before final submission.
* AC11 (Text input): Event name, description, and special requests have defined maximum character limits and are sanitised to prevent script injection.

_Note:_ SCRUM-13 owns the form and field-level input behaviour. SCRUM-15 owns draft persistence. SCRUM-14 owns the final submission gate. Event timezone is a required event attribute because lifecycle time comparisons must be unambiguous.

**Change log**

* 2026-10-29 (SCRUM-243, PO approval pending): added the Superseded in part note for SCRUM-129, SCRUM-171 and SCRUM-190. Criteria unchanged.
* 2026-10-29 (SCRUM-243, PO approval pending): the Superseded in part note lists one change per bullet, to be easier to read; what it says is unchanged. Criteria unchanged.
