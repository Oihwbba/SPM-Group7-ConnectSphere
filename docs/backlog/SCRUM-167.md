<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-09. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-167 - [MERGED INTO SCRUM-166] An event can't be confirmed until its safety check is approved

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 0 |
| **Status in Jira** | Done |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-167 |

---

\*Merged into SCRUM-166 on 2026-10-07 (backlog refinement).\* This story's AC1–AC7 are SCRUM-166 AC9–AC15, in the same order. References to SCRUM-167 in other stories now mean SCRUM-166. The original text is kept below for history.

\----

\*User story:\* As an Event Coordinator, I want confirmation to wait for an approved safety check, so that an event goes ahead only once its arrangements are judged safe.

\*Acceptance criteria\*

\# The readiness checklist (SCRUM-110) gains a Safety check item showing Not requested, Awaiting review, Approved, Changes requested, Rejected or Outdated. Given it isn't Approved, then Confirm (SCRUM-81) isn't available, and a direct confirm request is refused with the status unchanged.

\# Given the outcome is Changes requested, then the arrangements the Safety Officer picked are flagged Needs Reconsideration (SCRUM-26) with the note, and the event stays in Planning.

\# Given the outcome is Rejected, then every venue booking and equipment reservation of the event is flagged and the event stays in Planning. It isn't rejected or cancelled automatically: the Coordinator re-plans, rejects it (SCRUM-117) or cancels it (SCRUM-82).

\# Given the flags are resolved, when the Coordinator requests a new check (SCRUM-166), then the item shows Awaiting review.

\# Given a check is Approved or awaiting review, when the expected attendance, the layout or accessibility needs, any venue booking or any equipment reservation changes, including when a Confirmed event returns to Planning (SCRUM-128, SCRUM-26), then the check becomes Outdated. An Outdated check can't be approved, and a new check is needed before the event is confirmed again.

\# Approval doesn't confirm the event; the Coordinator still confirms it (SCRUM-81).

\# The safety check is a step within Planning, not a new event status; its states are named as in SCRUM-131.

\*Supersedes:\* SCRUM-81 AC3–AC4 and SCRUM-110 AC5 (Confirm available once venue and equipment are complete).

\*Customer basis:\* Week 7 change 6: "If changes are required, the event returns to the relevant earlier planning stage and affected venue or technical arrangements may need to be reviewed again. The event cannot proceed to preparation until the Safety Officer has approved it. You can assume that the Safety Officer will always give a response (approve/reject/request)."

\*Why this is a new story:\* SCRUM-81 and SCRUM-110 (Sprint 2, Done) let the Coordinator confirm once venue and equipment are secured.

\*Change log\*

* 2026-10-07 (Week 7 change 6): created.

* 2026-10-07 (backlog refinement): merged into SCRUM-166.

Functionality Area: Operational Feasibility Check, Event Status Management
