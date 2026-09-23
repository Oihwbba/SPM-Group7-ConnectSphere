<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-23. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-76 - View my registration status

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | High |
| **Story points** | 1 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-76 |

---

As an Attendee, I want to see the events I am registered for and the status of each, so that I know what I am committed to attending.

Acceptance Criteria:

* The Attendee sees a list of their own registrations with event name, date, time, venue and registration status
* Status values cover at least registered, withdrawn and cancelled
* An event cancelled by ConnectSphere shows as cancelled in the Attendee's list
* An event whose date or time changed shows the current details, not those at the time of registering
* The list contains only that Attendee's registrations


Note: the fourth criterion connects to "System flags dependent bookings when a major field changes" (SCRUM-44) under the Event Change & Notifications epic, which marks registrations as needing reconsideration when an event's date, time or venue changes. Agree with that epic's owner which story owns telling the Attendee.

INVEST: Independent (needs "Register for an event"); Negotiable (whether withdrawn registrations remain listed or disappear); Valuable (the Attendee's only view of their own commitments); Estimable and Small (one filtered read); Testable (assert list contents per status and per owner).

Functionality Area: Attendee Registration
