<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-73 - Register for an event

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-73 |

---

As an Attendee, I want to register for an event, so that my place is recorded and the organisers know to expect me.

Acceptance Criteria:

* Registering creates a registration linked to the Attendee and the event.
* The registration is immediately visible to the Attendee with a status of registered.
* Places are allocated first come, first served — there is no approval queue and no Organiser decision on individual registrations.
* The same Attendee cannot hold two active registrations for the same event.
* Registering reduces the event's remaining capacity by one.
* Registration is refused for any event that is not Confirmed with registration enabled.
* For Release 1, the event's expected attendance is the registration capacity; there is no separate attendee-capacity value.

Business rule: Organiser discretion controls the registration window through SCRUM-75, not individual attendee approval.

Functionality Area: Attendee Registration
