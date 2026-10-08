<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-09. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-110 - See an event's readiness checklist

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-110 |

---

**User story:** As an Event Coordinator, I want to see a readiness checklist of an event's essential arrangements, so that I know exactly what is outstanding before I can confirm it.

**Acceptance criteria**

1. The checklist for a Planning event always includes Venue booking. It is complete only when a venue booking for this event is Approved and covers the event's whole period.
2. Given the event has no venue booking, a Pending one or a Rejected one, then the Venue item shows "Not requested", "Pending" or "Rejected – <reason>" and is incomplete. Given an Approved booking no longer covers the event's period, then it shows "Approved for a different time" and is incomplete.
3. If the event has an equipment request that is Pending Review, In Review or Approved, the checklist includes Equipment. It is complete only when every requested line is reserved in full for the event's period. If there is no equipment request, the item isn't shown and doesn't block confirmation.
4. Given a requested item isn't reserved in full, then the Equipment item names it (e.g. "Not fully reserved: Projector"). Given the event's only equipment request was Rejected, then Equipment shows "Rejected" and is incomplete.
5. Given every item is complete, then the checklist shows Ready to confirm, which enables the Confirm action in SCRUM-81.
6. The assigned Coordinator sees the checklist on the event page. The Organiser sees the item names and states but not internal reasons.

**Extended by later stories (not part of this one):** Equipment shown as "Not requested yet" when the Organiser listed equipment but no request exists (SCRUM-170); flagged bookings or reservations counted as incomplete (SCRUM-26).

**Change log**

* 2026-10-01 (mid-sprint correction, no new scope): removed the "Projector 3/5 reserved" example and said approval is all-or-nothing (withdrawn below).
* 2026-10-01 (audit): restored the 30 Sep criteria the branch was built against: Equipment is complete when reservations cover every requested line, so a partial reservation is shown. This withdraws the earlier 1 Oct edit, which contradicted the code under review. AC1, AC2 and AC4 add states the branch already shows: Not requested, Approved for a different time, and an equipment request that was only ever rejected.
* 2026-10-03: AC4 no longer shows the reserved/requested shortfall per line (PO decision). A partial reservation still leaves Equipment incomplete under AC3.
* 2026-10-04: AC4 names the items not yet reserved in full, without counts, so the Coordinator can see what is missing (PO decision).
* 2026-10-07: the "Not requested yet" extension points to SCRUM-170, which took it over when SCRUM-127 was split.

Functionality Area: Event Status Management
