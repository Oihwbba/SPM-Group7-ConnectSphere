<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-15. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-166 - Operational safety check: Safety Officer reviews arrangements before the event can be confirmed

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 8 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-166 |

---

**User story:** As a Safety Officer, I want to review an event's venue and equipment arrangements before it is confirmed, and as an Event Coordinator I want confirmation to wait for an approved safety check, so that no event goes ahead with an unsafe setup.

**Acceptance criteria**

1. Given an event in Planning whose Venue checklist item is complete (SCRUM-110, SCRUM-162) and whose Equipment item is complete, with an equipment request or No equipment needed (SCRUM-110, SCRUM-170 AC4), when its assigned Coordinator requests a safety check, then the check joins the Safety Officers' queue, oldest first, and every Safety Officer is notified (SCRUM-124). Until then, the request isn't offered and a direct request is refused.
2. Given I open a check, then I see, read-only: the expected attendance; for each venue its capacity, the attendance booked for it, the requested and supported layouts, the accessibility needs and features, its setup and turnaround times, and its known restrictions such as emergency access (SCRUM-34); the reserved equipment with each line's technical requirements, where its placement is noted; and the operational notes.
3. When I record Approved, Changes requested or Rejected, then Changes requested and Rejected need a note, and for Changes requested I pick at least one venue booking or equipment reservation it affects.
4. The Coordinator is notified of the outcome and the note (SCRUM-124). The Organiser sees the checklist state, not the note.
5. Every check and outcome is kept, with who recorded it and when.
6. Only Safety Officers record outcomes, and never for an event they organise or coordinate (SCRUM-121).
7. Recording an outcome a second time changes nothing; requesting a check while one is awaiting review shows the existing one.
8. Given two Safety Officers record an outcome on the same check at the same moment, then only the first is saved and the second is shown it.
9. The readiness checklist (SCRUM-110) gains a Safety check item showing Not requested, Awaiting review, Approved, Changes requested, Rejected or Outdated. Given it isn't Approved, then Confirm (SCRUM-81) isn't available, and a direct confirm request is refused with the status unchanged.
10. Given the outcome is Changes requested, then the arrangements the Safety Officer picked (AC3) are flagged Needs Reconsideration (SCRUM-26) with the note, and the event stays in Planning.
11. Given the outcome is Rejected, then every venue booking and equipment reservation of the event is flagged and the event stays in Planning. It isn't rejected or cancelled automatically: the Coordinator re-plans, rejects it (SCRUM-117) or cancels it (SCRUM-82).
12. Given the flags are resolved, when the Coordinator requests a new check (AC1), then the item shows Awaiting review.
13. Given a check is Approved or awaiting review, when the date, time, expected attendance, layout or accessibility needs, any venue booking or any equipment reservation changes, including when a Confirmed event returns to Planning (SCRUM-128, SCRUM-26), then the check becomes Outdated. An Outdated check can't be approved, and a new check is needed before the event is confirmed again.
14. Approval doesn't confirm the event; the Coordinator still confirms it (SCRUM-81).
15. The safety check is a step within Planning, not a new event status; its states are named as in SCRUM-131.

**Supersedes:** SCRUM-17's viewing rule, for Safety Officers. SCRUM-81 AC3–AC4 and SCRUM-110 AC5 (Confirm available once venue and equipment are complete). **Note on preparation:** Week 7 says the safety check must come before "preparation", which is Step 9 (SCRUM-123). SCRUM-123 is beyond Release 1, so blocking Confirm is the gate in this release.

**Customer basis:** Week 7 change 6: "After the venue and technical arrangements have been confirmed, the Safety Officer must conduct an Operational Safety Check before the event can proceed to preparation. The review considers factors such as expected attendance, venue capacity and layout, emergency access, accessibility requirements, equipment placement, crowd movement, and any known venue restrictions. The Safety Officer may approve the event, reject the safety arrangement, or request changes." "If changes are required, the event returns to the relevant earlier planning stage and affected venue or technical arrangements may need to be reviewed again. The event cannot proceed to preparation until the Safety Officer has approved it. You can assume that the Safety Officer will always give a response (approve/reject/request)."

**Why this is a new story:** the Safety Officer role and the Operational Safety Check are new in Week 7; no story covers them. SCRUM-81 and SCRUM-110 (Sprint 2, Done) let the Coordinator confirm once venue and equipment are secured.

**Change log**

* 2026-10-07 (Week 7 change 6): created.
* 2026-10-07 (backlog refinement): merged SCRUM-167; its AC1–AC7 are AC9–AC15 here. Neither story could be demonstrated or tested alone: a recorded outcome had no effect without SCRUM-167, and SCRUM-167's outcomes only exist once this story records them. Re-estimated from 5 to 8.
* 2026-10-07 (backlog refinement): group headings removed. AC1 needs the Equipment item only when the checklist shows one, so an event with no equipment can be checked. AC13 adds date and time, matching SCRUM-128 AC4.
* 2026-10-08 (PO review): AC1 counts "No equipment needed" as a complete Equipment item, so those events can get a safety check. Added a note on why Confirm, not preparation, is the gate in Release 1.
* 2026-10-09 (PO review): AC1 reworded, because SCRUM-170 AC4 always shows the Equipment item.

Functionality Area: Operational Feasibility Check, Event Status Management
