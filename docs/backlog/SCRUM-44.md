<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-44 - System flags dependent bookings when a major field changes

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-8 - Event Change & Notifications |
| **Priority** | High |
| **Story points** | 5 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-44 |

---

**As a Coordinator, Venue Staff member, or Technical Support Staff member**, I want dependent resource arrangements to be flagged when an approved impactful event change affects them, so that nothing falls out of sync silently.

**Acceptance Criteria:**

* Impactful fields are exactly date, time, expected attendance, venue and equipment.
* When an approved impactful change is applied, linked **venue bookings and equipment reservations** that may be affected are marked **Needs Reconsideration**.
* Active attendee registrations are **not** changed to Needs Reconsideration. They remain active unless the event itself is cancelled.
* For an approved change to date, time, or venue, affected active Attendees are notified through SCRUM-85 and their registration view shows the current event details.
* Non-impactful changes do not create a reconsideration flag.
* A flagged venue booking or equipment reservation remains flagged until a permitted resolution is recorded.
* The system never cancels a venue booking or equipment reservation automatically merely because it was flagged.
* A Coordinator can record that a flagged resource arrangement **still stands** or that it should be **cancelled/released**; either decision clears the flag.
* The resolution is recorded with who resolved it and when.
* For a Confirmed event, SCRUM-43 returns the event to Planning after an approved impactful change; the event cannot be Confirmed again until SCRUM-110 is true.
* Notification to affected Attendees is owned by SCRUM-85; resource-arrangement resolution is owned here.
