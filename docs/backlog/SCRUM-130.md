<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-29. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-130 - Discard a draft request

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Medium |
| **Story points** | 1 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-130 |

---

**User story:** As an Event Organiser, I want to discard a draft I no longer need, so that my request list only shows requests I'm still working on.

**Acceptance criteria**

1. Given a Draft I created, when I choose Discard and confirm, then it no longer appears in My Event Requests (SCRUM-84) and cannot be reopened.
2. Given I cancel the confirmation prompt, then nothing changes.
3. Discard is offered only for Drafts. A submitted request is cancelled through a change request (SCRUM-41).
4. No other user can discard my draft; a direct request to do so is refused (SCRUM-67).
5. Drafts never expire automatically in Release 1.
6. Given a draft's proposed start is in the past, when I open it, then it shows "Dates are in the past – update them before submitting". (Submission is already blocked by SCRUM-13 AC9.)

**Basis:** Team proposal: manual discard, no automatic expiry.

**Why this is a new story:** SCRUM-15 (Sprint 1, Done) saves drafts but gives no way to remove one, and no draft-expiry mechanism was proposed.

Functionality Area: Draft Event Requests
