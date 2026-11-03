<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-263 - Bug: The event request form says to fix the highlighted fields but highlights none

| | |
|---|---|
| **Type** | Task |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | High |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-263 |

---

The Organiser's event request form (SCRUM-13 AC3, AC11) refuses a request and shows "Please fix the highlighted fields", but nothing on screen is highlighted, so the Organiser can't tell what to fix.

**1. Event Programme and Special Requests can't show an error.** Both are limited to 5,000 characters (SCRUM-13 AC11). Over the limit the action refuses the request and returns the field's error, but these are the only two text boxes on the form that neither mark themselves invalid nor print the message. (`app/(app)/events/create-event-dialog.tsx`, step 5.)

**2. An error on another step can't be seen from where the form was submitted.** A request is submitted from step 6, Review, but errors appear only on the step that holds the field, and Review flags only missing fields. A name of 201 characters is refused with nothing highlighted until the Organiser goes back to step 1 and finds it. Saving a draft from another step has the same gap.

**3. Registration Notes has no limit on a draft**, and no message of its own on submitting.

**4. Four open-text fields have no limit on the form, but do on a later change.** Venue Requirements, Accessibility Needs, Equipment Requirements and Room Layout have no limit on the request form or the Coordinator's edit, though a clarification answer and a change request limit them to 5,000 characters, and Room Layout to 200. So an Organiser can submit text that a later clarification answer or change request is refused for.

**Cause:** the two fields have no error display, the form stays on the current step after a refusal, and some open-text fields have no limit.

**Acceptance criteria**

1. Event Programme, Special Requests and Registration Notes show their over-limit message next to the field and are marked invalid, like the form's other fields, on saving a draft and on submitting. Text at exactly the limit of 5,000 characters is accepted.
2. When submitting or saving a draft is refused with field errors, the form opens the first step that has one, so a highlighted field is on screen.
3. Venue Requirements, Accessibility Needs and Equipment Requirements hold at most 5,000 characters and Room Layout at most 200, on saving a draft, on submitting and on the Coordinator's edit, the same limits as a clarification answer and a change request. The Coordinator's edit also limits Registration Notes to 5,000. Text at exactly the limit is accepted; text over it is refused with the field's message next to the field, and nothing is saved.

**Change log**

* 2026-11-02: created in Sprint 4 from an Organiser form check of SCRUM-13 AC11.
* 2026-11-02: added Registration Notes to AC1.
* 2026-11-02: added AC3, after finding the request form and the Coordinator's edit had no limit on four open-text fields that clarification answers and change requests limit.
