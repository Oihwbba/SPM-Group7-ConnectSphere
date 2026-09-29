<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-77 - Withdraw my registration

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Medium |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-77 |

---

As an Attendee, I want to withdraw from an event I can no longer attend, so that my place is released and ConnectSphere has an accurate headcount.

Acceptance Criteria:

* Given an active registration, when the Attendee withdraws, then its status becomes withdrawn and it stops counting toward the event's registered total.
* Given an active registration, when the Attendee withdraws, then the event's remaining capacity increases by exactly one.
* Given a registration that has already been withdrawn, when the Attendee withdraws again, then nothing changes and no additional place is released.
* The withdrawal is visible to the Attendee immediately and to the Organiser and Coordinator in their registration view.
* An Attendee cannot withdraw another Attendee's registration.
* A withdrawn Attendee may register again for the same event while registration is open, the event remains Confirmed, and capacity is available; the new registration is treated as a new active registration.
* Withdrawal is permitted until the event start instant; after the start instant an active registration cannot be withdrawn through this story.
* Re-registration is subject to the same first-come, first-served capacity and registration-window rules as SCRUM-73–75.


Boundary: withdrawal records are retained rather than deleted, preserving registration history and auditability.

Functionality Area: Attendee Registration
