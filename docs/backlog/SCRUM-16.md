<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-16 - Distinguish drafts from submitted requests

| | |
|---|---|
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Medium |
| **Story points** | 1 |
| **Status in Jira** | In Review|
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-16 |

---

**As an Event Organiser**, I want my draft requests to look visibly different from submitted ones in my list of requests, so that I can tell at a glance which ones still need work.

**Acceptance Criteria:**

- AC1 (Visual badge and distinct styling): Draft requests must display a dedicated, visually distinct status badge (e.g., neutral grey DRAFT badge) across all list and card views where requests are listed.
- AC2 (State separation): Draft items must be visually differentiated from actionable or lifecycle states using distinct color tokens and badge variants adhering to accessibility guidelines.
- AC3 (Visual comparison in list view):
  - Given an Organiser is viewing their list of event requests containing both draft and submitted requests,
- When the page renders,
- Then each draft request displays a prominent "Draft" indicator and an explicit "Resume Editing" action, while submitted requests display their respective lifecycle status badge and a read-only view action.
- AC4 (Coordinator view exclusion):
  - Given an Event Coordinator or Technical Staff member views incoming requests for review,
- When querying submitted events,
- Then unsubmitted DRAFT requests are completely excluded from coordinator dashboards and calendars.
- AC5 (Accessibility compliance): The visual distinction must rely on both color and text/icon labels to ensure compliance with WCAG AA accessibility standards.

**Dependency note:** this assumes a "my requests" list view already exists to apply the marking to. No story in this epic currently builds that list view explicitly — it's implicitly required by this story and by "Save an event request as a draft" (its AC: "Organiser can find and resume any of their saved drafts"). Confirm during backlog refinement whether a basic list view should be its own story, or folded into one of these two.



Functionality Area: Draft Event Requests & Event Status Management
