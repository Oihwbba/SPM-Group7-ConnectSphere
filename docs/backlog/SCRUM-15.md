<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-08. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-15 - Save an event request as a draft

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | High |
| **Story points** | 1 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 1 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-15 |

---

**As an Event Organiser**, I want to save an incomplete event request as a draft, so that I can finish it later without losing my progress.

_Acceptance Criteria:_

* AC1 (Incomplete entry saving): An Organiser can save an event request as a DRAFT at any point prior to formal submission, even if mandatory fields (such as venue requirements, attendance, or equipment) are incomplete or empty.
* AC2 (Data retention and fidelity): All partially filled fields are persisted without data loss and accurately restored when the Organiser reopens the draft.
* AC3 (Saving draft with minimal information):

    * Given an Organiser has entered at least an Event Name (or minimal draft identifier),
    * When they select "Save as Draft",
    * Then the event is persisted with a status of DRAFT, a success notification is displayed, and the user can exit or continue editing.

* AC4 (Draft validation relaxation):

    * Given mandatory submission fields are left blank (e.g., zero attendance or missing venue requirement),
    * When the user selects "Save as Draft",
    * Then the system bypasses strict submission validation rules and successfully saves the current state.

* AC5 (Resuming draft edit):

    * Given an existing draft request,
    * When the Organiser reopens the draft from their request list,
    * Then the form populates with all previously saved values and remains in DRAFT status until explicitly submitted.

* AC6 (Auto-save and unsaved changes warning): If an Organiser attempts to navigate away from an edited draft without saving, the system displays a confirmation prompt warning of unsaved changes.
* NEW AC7 (Draft save idempotency): Repeatedly selecting “Save as Draft” for the same draft updates the existing draft record and does not create duplicate event requests.
* NEW AC8 (Draft reviewer exclusion): Saving an event request as DRAFT does not make it visible in Coordinator review queues, Coordinator dashboards, calendars, or submitted-event views.
* NEW AC9 (Draft resume with inactive catalogue reference): If a reopened draft references a venue or equipment catalogue item that no longer exists or is no longer active, the draft still opens with the saved information, but the affected field is marked for correction before formal submission.


Functionality Area: Draft Event Requests
