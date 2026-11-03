<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-258 - Bug: A Confirmed event's flagged arrangements read as secured

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-258 |

---

On a Confirmed event with a flagged booking or reservation, the event page calls it secured: the next-step banner says "the arrangements are secured", and Confirmed arrangements lists it with no warning. The Changes tab shows the same arrangement flagged. This misses SCRUM-131 AC3.

**Acceptance criteria**

1. With an unresolved flag, the Organiser's banner reads "Waiting for \[Coordinator\] to decide what happens to the flagged arrangements" and opens on Changes. The Coordinator's still asks them to decide.
2. Confirmed arrangements keeps a flagged reservation or live booking listed, with a Needs Reconsideration badge beside it.
3. Unflagged arrangements, cancelled reservations and ended bookings show no badge, and the panel shows no flag reason.

Related: SCRUM-131, SCRUM-26, SCRUM-208.
