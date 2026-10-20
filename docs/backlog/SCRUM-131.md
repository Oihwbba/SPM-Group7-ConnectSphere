<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-131 - Use the agreed status names on every screen

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Medium |
| **Story points** | 2 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-131 |

---

**User story:** As any ConnectSphere user, I want every screen to use the same status names, so that I'm never unsure whether two labels mean the same thing.

**Acceptance criteria**

1. Event statuses are shown exactly as Draft, Submitted, Under Review, Approved, Planning, Confirmed, Completed, Cancelled, Rejected. The Organiser's "Submitted" tab in My Event Requests (SCRUM-84), which lists every request that isn't a draft, is renamed "Sent" so it isn't mistaken for the Submitted status.
2. Venue bookings are shown as Pending, Held, Approved, Rejected, Expired or Cancelled. Equipment requests are shown as Pending Review, In Review, Approved, Rejected or Cancelled. Equipment reservations are shown as Reserved or Cancelled, never "Confirmed".
3. Needs Reconsideration is shown as a separate warning badge next to a booking's or reservation's status, never in place of it (SCRUM-26).
4. Registrations are shown as Registered, Withdrawn or Cancelled, never "Confirmed".
5. Change requests are shown as Submitted, Approved or Rejected.
6. Attendees never see an internal event status other than Confirmed, Completed or Cancelled; see SCRUM-85.
7. Safety checks are shown as Not requested, Awaiting review, Approved, Changes requested, Rejected or Outdated (SCRUM-166). The safety check is a step within Planning, not an event status, so the event still shows Planning.

**Related:** these are display names. Stored values can differ; for example a reservation stored as CONFIRMED is shown as Reserved, and a change request stored as PENDING_REVIEW is shown as Submitted.

**Why this is a new story:** SCRUM-84 (Sprint 1, Done) names the Organiser's tab "Submitted", although it also lists requests that are Under Review, in Planning, Confirmed and so on. Reservations are stored as CONFIRMED (SCRUM-31, Done), and the team's lifecycle table named registrations "Confirmed"; both collide with the event status.

**Change log**

* 2026-10-01 (audit): AC1 corrected; the code has no "In Review" tab, and the Organiser's "Submitted" tab lists every request that isn't a draft. AC2 uses the built equipment statuses: request statuses, and Reserved for reservations (SCRUM-31). Waitlisted removed (SCRUM-79 is beyond Release 1). Handovers have no Rejected status, because SCRUM-21 has no decline step.
* 2026-10-07 (Week 7 changes 4 to 6): AC2 adds the Held and Expired booking statuses (SCRUM-163). AC5 drops the handover statuses, because the Lead now reassigns at once (SCRUM-21). AC7 names the safety check states and keeps the event in Planning (SCRUM-167). Re-estimated from 1 to 2 points.
* 2026-10-07 (backlog refinement): AC6 points to SCRUM-85 and AC7 to SCRUM-166, which SCRUM-133 and SCRUM-167 were merged into.

Functionality Area: Event Status Management
