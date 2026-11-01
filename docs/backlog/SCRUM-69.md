<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-01. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-69 - View only the events assigned to me

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-9 - Access Control |
| **Priority** | High |
| **Story points** | 2 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-69 |

---

**Partly superseded:** AC1's and AC4's unassigned Submitted events, and AC3's accepted handover, are replaced by SCRUM-165 AC8 (an unassigned request waits in the Lead's queue, not in every Coordinator's list) and SCRUM-21 (the Lead reassigns, effective at once, with no acceptance step). AC2 and the assigned-events part of AC1 still apply.

**User story:** As an Event Coordinator, I want my default event list to show the events assigned to me, so that I work from an accurate list of my responsibilities.

**Acceptance criteria**

1. My default event list contains the events where I am the assigned Coordinator, plus Submitted events that no Coordinator has yet (AC4).
2. The list shows each event's name, proposed dates and status, and can be searched, filtered and sorted like My Event Requests (SCRUM-84).
3. Given an event is handed over to another Coordinator (SCRUM-21), then it leaves my list and appears in theirs once the handover is accepted.
4. Given a Submitted event has no Coordinator, then it appears in every Coordinator's list until one is assigned. A Coordinator who approves it becomes its assigned Coordinator (SCRUM-81).

**Boundary:** other Coordinators' events are viewed read-only in the all-events list (SCRUM-141). Automatic assignment is SCRUM-20. Events whose start has passed while still Under Review or Planning are shown as Overdue in this list by SCRUM-82.

**Change log**

* 2026-10-01 (mid-sprint correction, no new scope): AC3 depends on SCRUM-21 (backlog); until handover exists, test it by changing the assignment in seed data.
* 2026-10-01 (audit): AC1 and AC4 now match the code and SCRUM-20 (Done), which promises an unassigned Submitted event "stays visible to Coordinators": it stays in every Coordinator's list until assigned. The earlier 1 Oct text hid it and relied on the event calendar, which is beyond Release 1. AC2 states the list features the code shares with My Event Requests.
* 2026-10-30 (PO approved, Hann Qian, after the SCRUM-216 epic check): marked partly superseded. Week 7 change 5 replaced the unassigned-event part of AC1 and AC4 with SCRUM-165 AC8 and the accepted handover in AC3 with SCRUM-21. The code and docs/testing/SCRUM-69.md already follow them (TC-69-05 marked superseded). The criteria are kept as written, as Done stories aren't rewritten. Story stays Done. No code change.

Functionality Area: User Authorisation and Authentication
