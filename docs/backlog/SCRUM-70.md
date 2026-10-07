<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-08. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-70 - Organisers and coordinators see an event's registrations; attendees' records stay private

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-9 - Access Control |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-70 |

---

**User story:** As an Event Organiser or Event Coordinator, I want to see the registrations for an event I manage, while each Attendee's own record stays private to them, so that I can plan against real numbers without exposing Attendees to each other.

**Acceptance criteria**

1. The assigned Coordinator can see the registration list only for events assigned to them.
2. The Organiser can see the registration list only for events they submitted.
3. The list shows the registered count, remaining capacity, and each registration's Attendee name and status (Registered, Withdrawn, Cancelled).
4. Withdrawn and Cancelled registrations are shown separately and don't count toward the registered total.
5. No other role can retrieve an event's registration list (SCRUM-67).
6. Given an Attendee requests another Attendee's registration by its identifier, then it is refused, and the refusal looks the same as if the registration didn't exist.
7. An Attendee can never see an event's attendee list. Their own list is SCRUM-76.

**Customer basis:** "Event Organisers and Event Coordinators can view appropriate registration information for the events they manage." Requirement 8b: "an Attendee should not be able to view internal planning information."

**Change log**

* 2026-09-29: merged SCRUM-78.
* 2026-10-01: one user story covering both halves; statuses aligned with SCRUM-131.
* 2026-10-01 (audit): removed the waiting-list count and the Waitlisted status, because the waiting list (SCRUM-79) is beyond Release 1. Group headings removed.

Functionality Area: Attendee Registration, User Authorisation and Authentication
