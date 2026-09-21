<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-75 - Control and enforce the registration period

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Medium |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-75 |

---

**As an Event Organiser**, I want to control when registration opens and closes, and **as an Attendee** I want that window enforced, so that nobody registers outside the permitted period.

**Acceptance Criteria — Organiser control**

* The Organiser can set a registration opening instant and closing instant for the event once it is Confirmed; registration cannot open before confirmation.
* The closing instant must be later than the opening instant and must not be later than the event start instant.
* Given an open registration period, when the Organiser extends the closing instant to a later valid time, registration remains open through the new instant.
* Given an open registration period, when the Organiser closes registration manually, it closes immediately.
* Once manually closed, registration does not reopen automatically unless the Organiser explicitly opens a new valid period.

**Acceptance Criteria — default and enforcement**

* If no registration period is configured, registration automatically becomes available when the event becomes Confirmed and remains available until the event start instant.
* Given the current time is before the registration opening instant, when an Attendee views the event, then registration is unavailable and the opening time is shown.
* Given the current time is at or after the opening instant and before or at the closing instant, when an Attendee registers, then registration is accepted, subject to the capacity rule in SCRUM-74.
* Given the current time is after the closing instant, when an Attendee views the event, then registration is unavailable and the event is shown as closed.
* Given the registration period has closed, when a registration request is submitted directly, then it is refused.
* Registration is never accepted once the event's start instant has passed, even if a stale registration window exists.
* Opening and closing instants are interpreted consistently with the event timezone defined in SCRUM-13 and persisted as UTC instants.

**Customer clarification (2026-09-13):** Registration may open once the event is confirmed; Organiser controls timing and may manually close. Waiting-list behaviour remains outside Release 1 and is owned by SCRUM-79 for future scope.

**INVEST:** This story contains Organiser controls plus enforcement. Re-estimate at **3 points** or split later if the implementation grows.

Functionality Area: Attendee Registration
