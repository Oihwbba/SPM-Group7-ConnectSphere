<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-26 - Flag bookings and reservations affected by an impactful change

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | High |
| **Story points** | 5 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-26 |

---

Merged story (29 Sep 2026): absorbs SCRUM-44 (System flags dependent bookings when a major field changes). Any reference to SCRUM-44 elsewhere now means this story. SCRUM-42 and SCRUM-43 are now part of SCRUM-41.

As an Event Coordinator, I want the system to warn me before an impactful planning edit affects existing arrangements, so that I can re-check those arrangements before confirming the change.

Acceptance Criteria:

* The impactful fields are exactly date, time, expected attendance, venue and equipment.
* Given an existing venue booking or equipment reservation, when the Coordinator changes one of those fields to a different value, then a warning is shown before the edit is confirmed.
* If the field value is unchanged, no warning is raised.
* If no booking or reservation exists, no arrangement-impact warning is required.
* The warning does not automatically cancel a booking or reservation.
* Once the Coordinator confirms the edit, dependent arrangements follow SCRUM-44's reconsideration path.
* This story covers Coordinator-initiated planning edits. Organiser-initiated post-submission changes use SCRUM-41–43.

---

Merged from SCRUM-44 — System flags dependent bookings when a major field changes

As a Coordinator, Venue Staff member, or Technical Support Staff member, I want dependent resource arrangements to be flagged when an approved impactful event change affects them, so that nothing falls out of sync silently.

Acceptance Criteria:

* Impactful fields are exactly date, time, expected attendance, venue and equipment.
* When an approved impactful change is applied, linked venue bookings and equipment reservations that may be affected are marked Needs Reconsideration.
* Active attendee registrations are not changed to Needs Reconsideration. They remain active unless the event itself is cancelled.
* For an approved change to date, time, or venue, affected active Attendees are notified through SCRUM-85 and their registration view shows the current event details.
* Non-impactful changes do not create a reconsideration flag.
* A flagged venue booking or equipment reservation remains flagged until a permitted resolution is recorded.
* The system never cancels a venue booking or equipment reservation automatically merely because it was flagged.
* A Coordinator can record that a flagged resource arrangement still stands or that it should be cancelled/released; either decision clears the flag.
* The resolution is recorded with who resolved it and when.
* For a Confirmed event, SCRUM-43 returns the event to Planning after an approved impactful change; the event cannot be Confirmed again until SCRUM-110 is true.
* Notification to affected Attendees is owned by SCRUM-85; resource-arrangement resolution is owned here.
