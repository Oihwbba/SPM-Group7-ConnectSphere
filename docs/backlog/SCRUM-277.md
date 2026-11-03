<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-277 - Chore: Fix the GLM Lows deferred from #307 (SCRUM-211) and #331 (SCRUM-207)

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Low |
| **Story points** | - |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-277 |

---

Follow-up the PO asked for (3 Nov), so the Lows don't hold up the #307 and #331 merges. UI and tests only: no change to actions, permissions or rules.

**From #307 (SCRUM-211)**

1. Remove the unused `QueueLoading` component (components/queues/queue-loading.tsx).
2. Reopening the booking Reject dialog clears the reason but kept the old error (check whether #331's reopen fix already covers it; if so, close this item with a note).
3. A booking cancelled after its approval is shown as cancelled by its approver (app/(app)/bookings/page.tsx): show who actually cancelled it, or no name.

**From #331 (SCRUM-207)**
4. The phone menu (components/app/sidebar.tsx) moves focus in and out but isn't announced as a dialog and doesn't keep Tab inside it: give it dialog semantics and a focus trap, or build it on the existing dialog component.
5. After a failed save, closing and reopening the venue, equipment-request and create-event dialogs still shows the old form-level error: clear it when the dialog opens.
6. Add committed tests for #331's two accessibility fixes: the Organiser's "Actions required" toggle reports its pressed state, and the phone menu moves focus in on open and back on close.
7. The change request's Reject dialog clears its old error on reopen (fixed in #331) but has no automated test: add one.
8. SCRUM-264's booking test passes even while the dialog closes on its own (it likely finishes within the closing animation): make it wait for the dialog to stay open, without weakening it.

**Acceptance criteria**

1. Each item is fixed or closed with a reason, each with a test where behaviour changes.
2. Existing tests pass without being weakened.
3. Commits are keyed to the story each fix belongs to (SCRUM-211, SCRUM-207, SCRUM-264), or to this task.
