<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-29. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-115 - Find an event to attend

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Low |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-115 |

---

**Beyond Release 1** (label `beyond-release-1`): kept in the backlog; do not pull into a sprint without customer confirmation. Not specifically required by customer, but would aid attendee in navigation.

**User story:** As an Attendee, I want to search, filter and sort the events I can register for, so that I can find one quickly without scrolling the whole list.

**Acceptance criteria**

1. Given I enter a keyword, then only events whose name or description contains it are shown, ignoring case.
2. Given I choose a start-date range, then only events starting within it (both dates included, Singapore time) are shown.
3. Given I choose a venue or location, then only events there are shown.
4. Given "Open for registration only" is on, then events that are full, not yet open, closed or already started are hidden; turning it off shows them again.
5. I can sort by start date (soonest first, the default) or by places remaining (most first).
6. Filters combine: an event shows only if it matches every active filter.
7. Given the filters match nothing, then "No events match your filters" is shown with a Clear filters action, distinct from "No confirmed events yet".
8. Given I applied filters, when I open an event and go back, then the same filters, sort and results are restored; a copied link reproduces them.
9. Given more than 20 events match, then the first 20 are shown with a way to load the rest; no event is skipped or shown twice.
10. Search, filters and sorting never show an event I couldn't otherwise see (SCRUM-72).

**Boundary:** SCRUM-72 owns which events are listed; this story only narrows and orders the list.

**Change log**

* 2026-10-01: "\[not required\]" prefix replaced by the `beyond-release-1` label; waiting-list reference removed (SCRUM-79 is now in Release 1 and unaffected).
* 2026-10-29: Justify why `beyond-release-1` label was used. Note on 2026-01-01 change log: SCRUM-79 is not in release 1.

Functionality Area: Attendee Registration (beyond first release)
