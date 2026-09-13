<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-16 - Distinguish drafts from submitted requests

| | |
|---|---|
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Medium |
| **Story points** | 1 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-16 |

---

**As an Event Organiser**, I want my draft requests to look visibly different from submitted ones in my list of requests, so that I can tell at a glance which ones still need work.

**Acceptance Criteria:**

* Draft requests are visually marked (e.g. a "Draft" label or status) wherever they appear alongside submitted requests
* Draft requests cannot be mistaken for "under review" or later statuses at a glance

**Dependency note:** this assumes a "my requests" list view already exists to apply the marking to. No story in this epic currently builds that list view explicitly — it's implicitly required by this story and by "Save an event request as a draft" (its AC: "Organiser can find and resume any of their saved drafts"). Confirm during backlog refinement whether a basic list view should be its own story, or folded into one of these two.

**INVEST:** Independent-ish (the visual treatment itself is separable from save logic, but silently assumes a list view exists — see dependency note); Negotiable (exact visual treatment is a UI decision); Valuable (directly required by the briefing: "draft requests should remain distinguishable"); Estimable/Small (a labelling/styling change, once the list-view dependency is resolved); Testable (a draft and a submitted request are visually distinguishable side by side).

‌

Functionality Area: Draft Event Requests & Event Status Management
