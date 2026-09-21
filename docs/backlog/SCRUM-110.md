<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-110 - Define event confirmation readiness

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-110 |

---

**Cross-cutting business rule — Event Confirmation Readiness**

This story defines the conditions under which a Planning event is considered ready for confirmation. It does not perform venue or equipment booking itself.

**Acceptance Criteria:**

* A Planning event is confirmation-ready only when an **approved venue booking** exists.
* If the event has an equipment request, a **confirmed equipment reservation** must also exist.
* If no equipment is requested, equipment does not block confirmation.
* A rejected venue booking or unconfirmed required equipment reservation means the event is not confirmation-ready.
* Release-1 treats a venue booking as an essential arrangement even when the Organiser did not specify a detailed venue requirement.
* After an approved impactful change to a Confirmed event, the event is in Planning and must satisfy this readiness rule again before becoming Confirmed.
* All resource reconsideration flags that resulted from the impactful change must be explicitly resolved before the event is considered confirmation-ready.
* SCRUM-81 consumes this readiness rule and owns the Planning → Confirmed status transition.
* The readiness rule is the single authoritative definition; other stories must not introduce a conflicting confirmation gate.

**Business decision:** Approval means sufficient information to begin planning; Confirmation means essential arrangements are complete.

Functionality Area: Event Status Management
