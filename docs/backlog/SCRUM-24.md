<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-24 - Keep event status consistent with actions taken

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 5 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-24 |

---

**Cross-cutting business rule — Event Status Integrity**

This story defines the single source of truth for event status. It does not reimplement each transition.

**Acceptance Criteria:**

* Each event has exactly one authoritative status field.
* The only event statuses are **Draft, Submitted, Under Review, Approved, Planning, Confirmed, Completed, Cancelled, Rejected**.
* Clarification is a sub-state of Under Review, not an event status.
* Each lifecycle transition has exactly one owning story:

    * Draft → Submitted — SCRUM-14
    * Submitted → Under Review — SCRUM-20
    * Under Review → Approved / Rejected — SCRUM-19
    * Rejected → Submitted — SCRUM-108
    * Approved → Planning — SCRUM-81
    * Planning → Confirmed — SCRUM-81
    * Confirmed → Planning after an approved impactful change — SCRUM-128
    * Any permitted pre-Completed state → Cancelled — SCRUM-82
    * Confirmed → Completed — SCRUM-82

* The Confirmed → Planning transition exists only when an impactful formal change request for a Confirmed event is approved; it re-opens planning so dependent arrangements can be re-established before reconfirmation.
* No other story may introduce a competing lifecycle transition.
* Concurrent readers use the same persisted status and cannot observe conflicting status values for the same event.

**Authoritative model:** see the Confluence page **ConnectSphere Cross-Cutting Requirements Model**.

**Current ownership note (2026-10-02):** SCRUM-135 is the current authoritative lifecycle-transition story and supersedes the transition table from the original Sprint 1 wording. This story remains the cross-cutting integrity rule; it does not reintroduce the merged SCRUM-43/SCRUM-83 stories.
