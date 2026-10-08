<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-09. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-123 - Record event preparation progress

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Low |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-123 |

---

**Beyond Release 1** (label `beyond-release-1`): tracking preparation progress is part of Event Readiness Tracking and Outstanding Action Tracking, both on the Week 4 list of features not required for Release 1, and the customer said the detail "will be discussed in the actual requirement doc". In Release 1 the readiness checklist (SCRUM-110) shows whether the venue and equipment are secured, and Venue Staff and Technical Support record preparation as operational notes on the event (SCRUM-25).

**User story:** As Venue Staff or Technical Support Staff, I want to record preparation progress for an event, so that the Coordinator can see what is ready before and during the event.

**Acceptance criteria**

1. Given an event in Planning or Confirmed has an Approved venue booking, Venue Staff can update three venue preparation items: Room setup, Layout, Accessibility arrangements.
2. Given an event has equipment reserved (SCRUM-31), Technical Support can update one preparation item per reserved equipment type (prepared and tested).
3. Each preparation item is Not started, In progress or Done, with an optional note.
4. Updates are allowed while the event is in Planning or Confirmed, including on the event day. After the event is Completed or Cancelled they are read-only.
5. Only Venue Staff can update venue items and only Technical Support can update equipment items; the Coordinator and Organiser can view them (SCRUM-67).
6. The Coordinator sees a summary on the event page, e.g. "Venue 2/3 done, Equipment 1/2 done".
7. Preparation progress does not affect confirmation (SCRUM-110).
8. Each update records who and when.

**Customer basis:** Step 9: "Venue Staff and Technical Support Staff update preparation progress (e.g., venue setup, physical room layout, equipment testing/installation) as work progresses prior to and during event delivery… Specific timing of marking items completed is left to operational convenience/implementation. Detail requirements will be discussed in the actual requirement doc." "Venue Staff and Technical Support Staff can update venue/equipment preparation details for the event requested."

**Change log**

* 2026-10-01: acceptance criteria were too thin to test; added the preparation items, who can update which, when updates are allowed (including after confirmation, which SCRUM-25 allows), and that progress doesn't block confirmation.
* 2026-10-01 (audit): beyond Release 1 (label `beyond-release-1`), following the Week 4 not-required list and the customer's note that details are still to be agreed; until then staff use operational notes (SCRUM-25). AC2 counts reserved equipment types, matching the built equipment model (SCRUM-31).

Functionality Area: Event Information Management (Event Preparation, Step 9)
