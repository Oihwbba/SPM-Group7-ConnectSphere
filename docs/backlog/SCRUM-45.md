<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-45 - Organiser and Coordinator workflow notifications

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-8 - Event Change & Notifications |
| **Priority** | High |
| **Story points** | 5 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-45 |

---

**User story:** As an Event Organiser or Event Coordinator, I want to be notified when something happens to an event I'm involved in, so that I stay informed without checking manually.

**Acceptance criteria**

1. Given a request is submitted and a Coordinator is assigned (SCRUM-14, SCRUM-20), then the Organiser and the assigned Coordinator each get one notification for the combined action.
2. Given a request is approved and moves to Planning (SCRUM-19, SCRUM-81), then the Organiser is notified.
3. Given a request or a Planning event is rejected (SCRUM-19, SCRUM-117), then the Organiser is notified with the reason and the outcome chosen in SCRUM-126.
4. Given an event is Confirmed (SCRUM-81), then the Organiser is notified.
5. Given a Confirmed event returns to Planning (SCRUM-128, SCRUM-26), then the Organiser is notified with the reason.
6. Given an event is cancelled (SCRUM-82), then the Organiser and the assigned Coordinator are notified with the reason.
7. Given an event is completed (SCRUM-82), then the Organiser and the assigned Coordinator are notified.
8. Given clarification is requested (SCRUM-18), then the Organiser is notified with what is needed. Given it is answered (SCRUM-108), then the Coordinator is notified.
9. Given a change request is approved or rejected (SCRUM-128), then the Organiser who raised it is notified, with the reason if rejected.
10. Given a handover is proposed (SCRUM-21), then the named Coordinator is notified. Given it is accepted, then both Coordinators and the Organiser are notified.
11. Given registration reaches capacity, closes at its closing time, or an Attendee withdraws from a full event (SCRUM-73–77), then the Organiser and the assigned Coordinator are notified.
12. Each notification names the event, says what happened, and links to the event.
13. Each trigger creates exactly one notification per recipient. Retrying the same action creates no duplicate.
14. The clarification sub-state never creates a generic status notification.
15. Attendee notifications are owned by SCRUM-85, and Venue Staff, Technical Support and arrangement notifications by SCRUM-124; this story does not duplicate them. Notifications appear in the recipient's notification list (SCRUM-48).

**Already built:** the Sprint 1 code sends AC1 and both halves of AC8.

**Customer basis:** "Notifications cover event submission, approval, registration updates, confirmation, cancellation." Briefing §6 trigger list. "No specific requirement, the team can decide what is the best approach" (recipients).

**Change log**

* 2026-10-01: rewritten as one table of triggers and recipients; staff notifications moved to SCRUM-124; re-estimated from 6 to 5.
* 2026-10-01 (audit): the table is now one numbered criterion per trigger. Removed the "handover declined" trigger (SCRUM-21 no longer has a decline step) and the reminders reference (SCRUM-122 is beyond Release 1). "Registration closes" now means at its closing time, not when the Organiser closes it themselves. Noted which notifications the Sprint 1 code already sends.

Functionality Area: Notification System
