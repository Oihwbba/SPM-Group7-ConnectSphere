<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-264 - Bug: Seven text boxes over 2,000 characters are refused with no error at the field

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | High |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-264 |

---

## Why

The confirmation audit in TC-132-09 (SCRUM-132 AC4) fails at step 2. AC4 says every validation error must say which field to fix and how, and step 2 checks that a refusal shows the action's message next to the field it names.

Seven text boxes have no limit in the browser, while the server refuses anything over 2,000 characters. The error never appears at the field, and it usually doesn't say what's wrong:

| Action | What the user sees when refused | Problem |
| --- | --- | --- |
| requestClarification | "Please fix the highlighted fields." | Nothing is highlighted |
| transitionEventStatus (reject) | "Please provide a valid event status action." | Doesn't mention the reason |
| rejectPlanningEvent | "Please provide a valid event to reject." | Doesn't mention the reason |
| cancelEvent | "Please provide a valid event to cancel." | Doesn't mention the reason |
| decideChangeRequest (reject) | "Please choose Approve or Reject." | Points at the wrong thing |
| decideBookingRequest (reject) | Default length message, as a toast | Doesn't name the field |
| recordSafetyCheckOutcome | Default length message, as a toast | Doesn't name the field |

TC-132-09's Expected Result only mentions success, which passes, so the failure comes from its step 2 and AC4.

## Done when

1. Over 2,000 characters in any of the seven text boxes is refused, and the message shows next to the box, which is marked invalid. The form stays open with the text kept, and nothing is written.
2. Each message names the field and how to fix it: "Keep the message under 2000 characters." (clarification), "Keep the rejection reason under 2000 characters." (rejecting an event request, a Planning event, a change request or a booking), "Keep the cancellation reason under 2000 characters." (cancelling) and "Keep the note under 2000 characters." (safety check).
3. Exactly 2,000 characters is accepted by all seven.
4. An invalid event, or any other input the user can't fix, is still refused with the action's existing message.
5. TC-132-09 records this failure and its fix.

Related: SCRUM-132, SCRUM-263.

## Change log

* 2026-11-02: created in Sprint 4 from the TC-132-09 audit.
* 2026-11-02: renamed from Chore to Bug, because it fixes a failed acceptance criterion.
