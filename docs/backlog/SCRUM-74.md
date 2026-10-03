<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-74 - Be prevented from registering for a full event

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | High |
| **Story points** | 3 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-74 |

---

**User Story:** As an Attendee, I want to be told clearly when an event is full rather than having my registration silently fail, so that I know to look elsewhere.

**Acceptance Criteria:**

* For Release 1, registration capacity equals the event's expected attendance; no separate registration-capacity field is maintained.
* Given an event has remaining capacity, when an Attendee registers, then the registration is accepted and remaining capacity decreases by exactly one.
* Given an event with remaining capacity of one, when two Attendees register at the same moment, then exactly one succeeds and the other is told the event is full.
* Given a full event, when an Attendee opens it, then the register action is unavailable and the event is shown as full.
* Given a full event, when a registration request is submitted directly, then it is refused and no registration is created.

**Concurrency rule:** allocation of the final available place is atomic so that simultaneous registration requests cannot oversubscribe the event.

Functionality Area: Attendee Registration
