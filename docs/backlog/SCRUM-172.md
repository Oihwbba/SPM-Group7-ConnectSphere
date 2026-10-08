<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-08. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-172 - Week 7 database migration: schema and booking rules in one migration

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-172 |

---

Write one database migration for every schema and database-rule change the Week 7 stories need, and merge it before those stories start, so four people don't write clashing migrations in parallel. Each story still builds its own behaviour on top.

Acceptance criteria:

1. Roles: Event Coordinator Lead and Safety Officer are added (SCRUM-164).
2. Venue: setup minutes and turnaround minutes (whole minutes, 0 or more, default 0) and known restrictions (optional text) are added (SCRUM-159, SCRUM-34). Existing venues start at 0 and 0.
3. Booking: the Held and Expired statuses, a hold expiry and a hold note (SCRUM-163), and the setup and turnaround minutes a booking was held or approved with (SCRUM-159 AC8).
4. Venue bookings and equipment reservations have the Needs Reconsideration flag fields: reason, raised when, resolved by and resolved when (SCRUM-26).
5. Unavailability reasons are Maintenance, Equipment failure, Renovation, Safety concern and Other (SCRUM-161). Existing rows move from Damaged to Equipment failure, and from Closure to Other with "Closure" kept in the note.
6. A safety check table records the event, the state (Awaiting review, Approved, Changes requested, Rejected or Outdated), the note, the arrangements picked for Changes requested, and who recorded the outcome and when (SCRUM-166).
7. Notifications have a show-from time, and the new notification types exist (SCRUM-48, SCRUM-124).
8. Event: a 'No equipment needed' decision, with who recorded it and when (SCRUM-170 AC4).
9. The booking rules in the database use occupied periods (SCRUM-159, SCRUM-161, SCRUM-162, SCRUM-163): no two Approved or Held bookings at a venue have overlapping occupied periods; no Approved or Held booking overlaps recorded unavailability; unavailability may overlap bookings but not other unavailability; and an event has at most one Pending, Held or Approved booking per venue.
10. The migration runs cleanly on an empty database and on the current seed data, and existing bookings keep their status.
11. Tests that relied on the old rules are updated in the same pull request, for example SCRUM-37's refusal of unavailability over an Approved booking, which SCRUM-161 replaces. All other tests still pass.

Related: SCRUM-147 updates docs/data-model.md for this schema. The full list of code changes is in §7 of the Week 7 analysis.  

Change log

* 2026-10-08: Removed references to SCRUM-127
