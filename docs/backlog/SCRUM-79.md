<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-79 - Join a waitlist when an event is full

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Low |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-79 |

---

BEYOND FIRST RELEASE — backlog only, do not pull into a sprint without customer confirmation.

As an Attendee, I want to join a waitlist when an event is full, so that I am offered a place if someone withdraws.

Acceptance Criteria:

* An Attendee may join the waitlist for a full event and sees their position
* When a registration is withdrawn, the first Attendee on the waitlist is offered the place
* An offered place is held for a stated period before passing to the next Attendee
* An Attendee may leave the waitlist at any time
* Waitlist entries do not count toward the registered total


Note: the Week 1 customer briefing mentions waitlists, but they are NOT among the twenty core features the customer identified for the first release. Kept in the backlog to show the epic's full shape without committing it to a sprint — the project instructions explicitly invite considering features beyond the first release in the product backlog and C4 models.

INVEST: Independent (needs the capacity and withdrawal stories); Negotiable (offer window, ordering, and notification mechanism are all undefined); Valuable (to the customer eventually, not to Release 1); Estimable and Small (one ordered queue, one offer timer); Testable (join, withdraw ahead of it, assert offer and expiry).

Functionality Area: Attendee Registration (beyond first release)
