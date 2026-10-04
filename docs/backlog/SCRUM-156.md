<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-156 - Only reserve equipment for events with an approved equipment request (follow-up to SCRUM-31 and SCRUM-155)

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-10 - Equipment Management |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-156 |

---

**User story:** As a Technical Support Staff member, I want the reserve form to offer only events whose equipment request I have approved, so that no stock is reserved for an event that never asked for it, or whose request was refused.

**Why:** review feedback on SCRUM-31 (4 Oct): "for equipment reservation, approved events should only come from decided event request". Today the one-type reserve form on Equipment offers every Approved or Planning event, whether or not it has an equipment request, and whatever Technical Support decided on it. The comment was flagged as needing its own story, separate from SCRUM-155.

## Acceptance criteria

1. Given events in Approved or Planning, when I open the reserve form, then only those with an **Approved** equipment request are offered.
2. Given an event whose equipment request is Pending Review, In Review, Rejected or Cancelled, or which has no request at all, then it is not offered, and reserving for it directly is refused with the same message as any other event that cannot take a reservation.
3. Given I check availability for a period and an equipment type (SCRUM-29) or view an item's commitments (SCRUM-30), then that still works without choosing an event.

## Decision needed before estimating

* **(a)** Keep manual reserving on the one-type form, with the event list filtered as above; or
* **(b)** Make the one-type form an availability checker only, and reserve through SCRUM-155's "Reserve an approved request" card, which already only offers approved requests.

(b) satisfies AC 1 and 2 by construction and removes a second way to reserve.

## Impact to plan for

* The seed has no approved request on an Approved or Planning event (the only one belongs to the Confirmed event), so with AC 1 alone the form's event list would be empty. The seed needs one.
* About 20 SCRUM-29/30/31 e2e tests reserve for "Approved — Research Symposium", which has no request. They need that seeded request, or rewriting if (b) is chosen.

**Related:** SCRUM-31 (reserve equipment), SCRUM-155 (reserve an approved request in one step), SCRUM-28 (approve a request), SCRUM-29/30 (availability and commitments).
