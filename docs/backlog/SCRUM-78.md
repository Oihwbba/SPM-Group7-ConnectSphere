<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-78 - View registrations for an event I manage

| | |
|---|---|
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Medium |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-78 |

---

**As an Event Coordinator**, I want to see who has registered for the events I coordinate, so that I can plan capacity, seating and catering against real numbers.

**Acceptance Criteria:**

* A Coordinator sees the registration list only for events assigned to them
* An Event Organiser sees the registration list only for events they submitted
* The list shows registered count, remaining capacity, and each registration's status
* Withdrawn registrations are distinguishable from active ones and are not counted in the registered total
* No other role can retrieve an event's registration list

**Note:** the visibility rules here are the ones defined in "View only the events I own" and "View only the events assigned to me" in the Access Control epic (SCRUM-9). This story must not restate them — it consumes them. If ownership logic ends up written twice, one of the two stories is wrong.

**INVEST:** Independent (needs "Register for an event" and the relationship rules from SCRUM-9); Negotiable (whether Attendee names or only counts are shown to Organisers is an open privacy question worth asking the customer); Valuable (named in core feature #18 as the internal half of the epic); Estimable and Small (one filtered read with two ownership variants); Testable (as coordinator, organiser, and each wrong role, assert the expected list or refusal).

Functionality Area: Attendee Registration
