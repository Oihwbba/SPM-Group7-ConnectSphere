<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-09. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-84 - Organiser views their own event requests

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-84 |

---

**As an Event Organiser**, I want to see a list of all my own event requests regardless of status, so that I can find drafts to resume and track anything I've already submitted.

**Acceptance Criteria:**

* AC1 (Ownership data isolation): The event request dashboard displays only the event requests where the currently authenticated user is designated as the submitting Event Organiser.
* NEW AC2 (Comprehensive lifecycle coverage): The view displays events across all valid lifecycle statuses (DRAFT, SUBMITTED, UNDER REVIEW, APPROVED, REJECTED, PLANNING, CONFIRMED, COMPLETED, CANCELLED).
* AC3 (Dashboard navigation and interaction):

    * Given an Organiser navigates to "My Event Requests",
    * When the list loads,
    * Then events are presented in reverse chronological order (most recently updated first), displaying Event Name, Proposed Dates, and Status Badge.

* AC4 (Selecting a request detail):

    * Given an Organiser is viewing their request list,
    * When they click on any request entry,
    * Then they are navigated to the full detail view for that specific event.

* AC5 (Empty state handling):

    * Given an Organiser has created no event requests,
    * When they visit the request dashboard,
    * Then an informative empty state message is shown with a call-to-action button to "Create New Event Request".

* AC6 (Status filtering and search): Organisers can filter their request list by status category (e.g., Drafts, In Review, Confirmed) or search by event name.
* AC7 (Default and column header sorting):

    * By default, event requests are ordered in descending order by last updated timestamp (updatedAt DESC).
    * Organisers can sort table columns (e.g. by Event Name alphabetically or by Proposed Start Date).

* AC8 (Multi-criteria filtering combination):

    * Given an Organiser applies a status tab filter (e.g. "Drafts") AND enters a search term in the search input,
    * When the list evaluates the criteria,
    * Then only events matching both the active status tab AND the case-insensitive search string (matching Event Name or Purpose) are displayed.

* AC9 (Search cleared state and partial matches):

    * Search matches partial substrings (e.g., typing "annual" matches "Annual Tech Conference").
    * Clearing the search input immediately restores the full filtered list according to the active status tab.


**Note:** closes a dependency three existing stories already assumed without anyone building it — "Save an event request as a draft" ("Organiser can find and resume any of their saved drafts"), "Distinguish drafts from submitted requests" (drafts must look distinct "wherever they appear alongside submitted requests"), and "View only the events I own" ("An Organiser's event list contains only events where they are the submitting Organiser"). All three describe rules for this list; this story is the list itself. Added 2026-09-06 following the full backlog synthesis.

Functionality Area: Draft Event Requests, Event Status Management
