<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-24 - Keep event status consistent with actions taken

| | |
|---|---|
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 5 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-24 |

---

**As an Event Coordinator**, I want every event to carry one single, always-current status, so that everyone looking at it sees the same accurate stage without anyone updating it by hand.

**Acceptance Criteria:**

* Status lives in exactly one place per event (single source of truth) — no screen caches or duplicates it separately
* Status is always one of the 9 agreed values: draft, submitted, under review, approved, planning, confirmed, completed, cancelled, or rejected. There is no tenth value — an open clarification is a sub-state of "under review" (see SCRUM-18), not a status of its own
* Each transition is owned by exactly one action, defined in that action's own story. This story guarantees those actions all write to the same consistent field — it does not redefine their logic:

    * draft → submitted — SCRUM-14 (Submit an event request for review)
    * submitted → under review — SCRUM-20 (Auto-assign a coordinator)
    * under review → approved / rejected — SCRUM-19 (Approve or reject)
    * **rejected → submitted** — SCRUM-19 (a rejected request may be amended and resubmitted)
    * approved → planning, and planning → confirmed — SCRUM-81
    * any status before completed → cancelled — SCRUM-82
    * confirmed → completed — SCRUM-83
    
* Two users viewing the same event at the same time never see conflicting statuses

**Note (2026-09-13):** two changes, both from the customer clarifications of that date.

1. The `rejected → submitted` transition is new. The customer confirmed rejection is not final: _"Rejected events may be resubmitted after appropriate changes are made."_
2. The original fourth criterion said the approved-onwards transitions "will be triggered by Venue Management and Event Change & Notifications actions, not yet broken into stories". Those stories now exist (SCRUM-81, 82, 83) and are named above, so the placeholder is replaced with the real owners.

**INVEST:** Independent — honestly, only partially: this is a cross-cutting rule that every status-changing story must honour, so size and test it alongside them rather than in isolation; Negotiable (status vocabulary still open, per the briefing's "examples may include..."); Valuable (directly prevents the briefing's own pain point of stale/contradictory status); Estimable/Small (one field, one consistency rule, one transition table); Testable (status after each owning action matches the expected transition; concurrent reads never disagree).

Functionality Area: Event Status Management
