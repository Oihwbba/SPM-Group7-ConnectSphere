<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-07. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-77 - Withdraw my registration

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | High |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-77 |

---

**User story:** As an Attendee, I want to withdraw from an event I can no longer attend, so that my place is released and ConnectSphere has an accurate headcount.

**Acceptance criteria**

1. Given an active registration, when I withdraw, then it becomes Withdrawn, stops counting toward the registered total, and the event's remaining places increase by exactly one.
2. Given my registration is already Withdrawn, when I withdraw again, then nothing changes and no extra place is released.
3. Withdrawal is allowed up to, but not including, the event's start time. After that it is refused.
4. The withdrawal shows immediately to me, and to the Organiser and Coordinator in their registration view (SCRUM-70).
5. I cannot withdraw another Attendee's registration, and the refusal looks the same as if it didn't exist (SCRUM-67).
6. Given I withdrew, I can register again while registration is open, the event is Confirmed and places are available. Registering again reactivates my same registration under the rules of SCRUM-73–75, and the earlier withdrawal stays in the event's history.
7. Withdrawn registrations are kept, not deleted.

**Related:** AC1, AC2 and AC5 are already built (the withdraw action shipped with SCRUM-74). AC3, AC4 and the history entry in AC6 remain.

**Notifications:** Organiser and Coordinator when someone withdraws from a full event (SCRUM-45).

**Change log**

* 2026-10-01: rewritten in one format; start-time boundary aligned with the other periods; notification owner named.
* 2026-10-01 (audit): AC6 matches the data model built for SCRUM-73, which keeps one registration per Attendee per event and reactivates it on re-registering. Removed the waiting-list hand-off, because SCRUM-79 is beyond Release 1. Noted what the SCRUM-74 code already delivers.

Functionality Area: Attendee Registration
