<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-09. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-159 - Include setup and turnaround time when checking venue availability

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Highest |
| **Story points** | 5 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-159 |

---

**User story:** As Venue Staff, I want each venue's setup and turnaround time to count when availability and conflicts are checked, so that no event is booked into a room that is still being prepared or reset.

**Acceptance criteria**

1. Given I edit a venue (SCRUM-34), when I save its setup time and turnaround time, then each must be a whole number of minutes from 0 to 1,440; any other value is refused and the field is named. Venues that existed before this story start at 0 and 0.
2. A booking's occupied period runs from its start minus the venue's setup time to its end plus the venue's turnaround time. For example, an event from 10:00 to 12:00 at a venue with 30 minutes' setup and 45 minutes' turnaround occupies the venue from 09:30 to 12:45.
3. Given a venue has an Approved or Held booking or recorded unavailability, when anyone searches for it (SCRUM-38), requests it (SCRUM-50), approves a request for it (SCRUM-53) or holds it (SCRUM-163), then the venue counts as unavailable wherever the new occupied period overlaps that booking's occupied period or the unavailability.
4. Occupied periods that only touch don't conflict. At a venue with 30 and 45 minutes, a booking from 10:00 to 12:00 (occupied 09:30–12:45) leaves 13:15–15:00 free (occupied from 12:45), but 13:00–15:00 is refused because its occupied period starts at 12:30.
5. Given two requests whose occupied periods overlap are approved or held at the same moment, then only one succeeds, the other is reported as conflicting, and the venue is never double-booked.
6. Given an occupied period starts before the venue opens or ends after it closes (SCRUM-34), then the request, hold or approval is refused and the opening hours are shown. An occupied period that starts exactly at opening or ends exactly at closing is accepted.
7. The venue availability calendar (SCRUM-36) shows each booking's setup and turnaround time around it, marked differently from the event itself.
8. A booking keeps the setup and turnaround times it was held or approved with. A later change to the venue's times doesn't move it; clashes that change creates are found by SCRUM-160.

**Supersedes:** SCRUM-36 AC2, SCRUM-50 AC2–AC4, SCRUM-52 AC3, SCRUM-53 AC4–AC6 and AC8. Each compared bare booking periods; they now compare occupied periods.

**Customer basis:** Week 7 change 1: "Each venue must therefore have a configurable setup time and turnaround time, and these periods must be included when checking availability and detecting booking conflicts. For example, an event scheduled from 10:00am to 12:00pm with 30 minutes of setup and 45 minutes of turnaround effectively occupies the venue from 9:30am to 12:45pm."

**Why this is a new story:** the venue booking stories (SCRUM-36, 50, 52, 53) are Done in Sprint 2 and compare bare booking periods. "Setup and Turnaround Time" was on the Week 4 not-required list; Week 7 makes it required.

**Change log**

* 2026-10-07 (Week 7 change 1): created.

Functionality Area: Setup and Turnaround Time, Booking Conflict Detection
