<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-28. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-211 - One layout for every work queue

| | |
|---|---|
| **Type** | Story |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | 1 |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-211 |

---

**User story:** As a member of staff deciding requests, I want every queue to work the same way, so that deciding is quick whichever queue I'm in.

**Acceptance criteria**

1. Every queue shows the same four columns: event, event date, what's asked, and requested (the date and how long ago, e.g. "23 Oct (3 days ago)"). Other details appear when an item is opened. Each queue keeps its current default order (oldest request first; Bookings soonest event first, SCRUM-52 AC1), and users can sort by event date or requested.
2. Every queue has the same status filter and search box.
3. Opening an item shows the decision on the same side of the page, with the same buttons in the same order.
4. After a decision, the next item in the queue opens.

**Customer basis:** Briefing, usability: "all user groups should manage common activities without extensive training." First come, first served: "Conflicts are handled on a first-come, first-served basis for venue/resources" (SCRUM-134), which is why the requested date stays visible.

**Why this is a new story:** the Unassigned Queue, Bookings, Equipment Requests and Safety Checks were built by different stories and each lays out and orders its items differently. Done stories are not reopened.

**Related:** applies to the queues of SCRUM-165, 52, 28 and 166. Stretch in Sprint 4: done after the event page and menu stories.

**Change log**

* 2026-10-21: created at Sprint 3 review for Sprint 4 (UI revamp U5). Owner Caylern.
* 2026-10-27 (PO approved, Hann Qian): AC1 reworded. "Oldest item first" conflicted with SCRUM-52 AC1 (Bookings: soonest event first), so each queue keeps its current default order and users can sort. "Waiting since" becomes "requested" (date and how long ago), which still shows the submission time first-come-first-served needs (SCRUM-134). The table is limited to four columns so it stays easy to scan; other details move to the opened item. No re-estimate.

Functionality Area: Venue Booking Approval, Equipment Request Management, Coordinator Assignment
