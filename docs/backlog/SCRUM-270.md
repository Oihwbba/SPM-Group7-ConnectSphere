<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-270 - Chore: Automate TC-132-09's confirmation audit

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-270 |

---

TC-132-09 (SCRUM-132 AC4) is a manual audit: list every server action a page calls that writes, and check the page confirms success and shows a refusal's message next to the field it names. It was run by hand on 19 Oct and 2 Nov 2026. The 2 Nov run found seven actions that broke step 2 (fixed in SCRUM-264). Nothing re-runs it when a new action or form is added.

Every client component calls its actions the same way (`ActionResult`, `toast.success`, `fieldErrors`), so the audit can run as a unit test over the source.

**Acceptance criteria**

1. A unit test lists every server action that a client component imports. It fails on an action that is neither listed as changing data nor listed as not changing it, so a new action has to be classified.
2. For every call of an action that changes data, the code handling its reply confirms success (`toast.success` or `toast.info`). The one deliberate exception in TC-132-09, marking a notification read, is named in the test with its reason. (The edit-details dialog needs no exception: its reply handler's `close` shows the toast.)
3. For every such call, a refusal's message is shown. Where the action can return `fieldErrors`, the caller reads them so the message shows at the field, unless the test names why not (the only field is an id the user doesn't type, a choice the button can't send empty, or the form's one error line sits under its only text box).
4. Breaking one form (removing its `toast.success`, or not reading `fieldErrors`) turns the test red.
5. TC-132-09 cites the new test instead of "Manual (audit)", and the test cases are recorded in `docs/testing/`.

**Related:** SCRUM-132 (AC4, TC-132-09), SCRUM-264 (the failure the 2 Nov audit found).
