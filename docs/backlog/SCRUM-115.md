<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-115 - Find an event to attend

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Medium |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-115 |

---

As an Attendee, I want to search, filter and sort the confirmed events, so that I can quickly find one I want to attend without scrolling the whole list.

Acceptance Criteria:

* Given the browse list, when the Attendee enters a keyword, then only events whose name or description contains it are shown, ignoring upper/lower case.
* Given the browse list, when the Attendee chooses a start-date range, then only events starting within that range (inclusive of both dates, in the event's timezone) are shown.
* Given the browse list, when the Attendee chooses a venue or location, then only events at that venue or location are shown.
* Given the "Open for registration only" option is on, when the list loads, then events that are Full, not yet open, closed or already started are hidden; turning it off shows them again.
* The Attendee can sort by start date (soonest first, the default) or by places remaining (most first).
* Filters combine: an event is shown only if it matches every active filter.
* Given the active filters match no events, when the list loads, then "No events match your filters" is shown with a "Clear filters" action, distinct from the "No confirmed events yet" message.
* Given the Attendee has applied filters, when they open an event and go back, then the same filters, sort and results are restored; a copied link reproduces them.
* Given more than 20 matching events, when the list loads, then it shows the first 20 with a way to load or page to the rest; no event is skipped or shown twice.
* Search, filters and sorting never reveal an event the Attendee could not otherwise see (only Confirmed, non-Cancelled events, as in SCRUM-72).

Boundary: SCRUM-72 owns the list's content and visibility rules; this story only narrows and orders it. Waiting lists stay out of scope (SCRUM-79).
