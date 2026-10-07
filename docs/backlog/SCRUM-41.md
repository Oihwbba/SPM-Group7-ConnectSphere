<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-08. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-41 - Raise and track a change request

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-8 - Event Change & Notifications |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-41 |

---

**User story:** As an Event Organiser, I want to request changes to my submitted event and track that request, so that my Coordinator reviews changes before they take effect.

**Acceptance criteria**

1. Given my event is Under Review, Planning or Confirmed, I can raise a change request for any event field, or a request to cancel the event with a reason.
2. Draft events are edited directly (SCRUM-15). Rejected events use SCRUM-108. Cancelled and Completed events cannot be changed. A Submitted event has no Coordinator to decide a change request until the Lead assigns one (SCRUM-165); until then the Organiser can't change or withdraw it.
3. Given my event is Under Review with an open clarification, then the fields that clarification names are changed through the clarification response (SCRUM-108), not a change request.
4. Requested values are validated with the request-form rules in SCRUM-13 and SCRUM-127: attendance is a positive whole number, the end is after the start, the start is not in the past, and venue and equipment come from the catalogues.
5. Fields that are date, time, expected attendance, venue or equipment are marked impactful on the request. The venue requirement may name several venues (SCRUM-162).
6. Given I submit, then the change request is Submitted, the event's values are unchanged, and I can see the request's status (Submitted, Approved, or Rejected with reason).
7. An event has at most one Submitted change request. A second one is refused and the open one is shown.
8. Given the event is cancelled or rejected while a change request is Submitted, then the change request becomes Rejected with that reason.
9. The assigned Coordinator can raise a change request on the Organiser's behalf after agreeing it offline. It is labelled "Raised by Coordinator for \[Organiser name\]" and is decided like any other.
10. Only the event's submitting Organiser and its assigned Coordinator can raise a change request (SCRUM-67).

**Decision and application:** SCRUM-128. **Notifications:** Coordinator when raised (SCRUM-124); Organiser on the outcome (SCRUM-45).

**Customer basis:** "Organiser cannot directly edit after submission; must request via Coordinator." "Change requests may cover several field and the Coordinator will review and processes updates." "Significant changes require review offline before changes are made on the system."

**Change log**

* 2026-10-01: split at backlog refinement; deciding and applying moved to SCRUM-128 and the estimate dropped from 8 to 3. Added validation and Coordinator-raised requests.
* 2026-10-01 (audit): Submitted removed from AC1, because a Submitted event has no Coordinator to decide the request. Requested venue and equipment values are catalogue choices (SCRUM-127).
* 2026-10-07 (Week 7 changes 3 and 5): AC2 waits for the Lead to assign a Coordinator (SCRUM-165) instead of automatic assignment. AC5 lets the venue requirement name several venues (SCRUM-162).
* 2026-10-07 (backlog refinement): AC2 states that a Submitted request can't be changed or withdrawn while it waits for the Lead; once it is Under Review the Organiser raises a change or cancellation request (AC1).

Functionality Area: Event Change Requests
