<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-122 - Remind Coordinators about incomplete and overdue arrangements

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-8 - Event Change & Notifications |
| **Priority** | Medium |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-122 |

---

**Beyond Release 1** (label `beyond-release-1`): Reminder System is on the Week 4 list of features not required for Release 1. The customer asked for reminders, and the team's 13 Sep customer Q&A register records "Keep it out" for that reason. In Release 1 nothing is hidden: overdue events are shown in the Coordinator's list (SCRUM-82, SCRUM-69) and outstanding arrangements on the readiness checklist (SCRUM-110); only the reminders are missing. If built, it can reuse the scheduled job SCRUM-82 adds for completion.

**User story:** As an Event Coordinator, I want reminders about upcoming events whose arrangements are still incomplete, so that nothing is missed before the event.

**Acceptance criteria**

1. Given an event assigned to me starts within N days and is Under Review, or is in Planning with an incomplete readiness checklist (SCRUM-110), then I get a reminder listing what is outstanding.
2. Given a Confirmed event starting within N days has an unresolved Needs Reconsideration flag (SCRUM-26), then I get a reminder naming the flagged arrangement.
3. N (default 7 days) and the reminder frequency (default once a day) are set in the system configuration. There is no settings screen.
4. An event produces at most one reminder per frequency period.
5. Given an event is shown as Overdue (its start time has passed while it is still Under Review or Planning, SCRUM-82), then I get a daily reminder to cancel (SCRUM-82) or reject (SCRUM-117) it. Nothing changes automatically.
6. Reminders stop once the event is Confirmed with no unresolved flags, or is Cancelled, Rejected or Completed.
7. Reminders appear in my notification list (SCRUM-48).

**Customer basis:** "Reminders for incomplete arrangements should be supported; frequency configurable in the system. Proactive or reactive depends on team's implementation as long as the user is notified." "If essential requirements cannot be fulfilled, the event gets rejected rather than sitting pending indefinitely."

**Change log**

* 2026-10-01: rewritten in one format with defaults so it can be tested; Under Review events, Confirmed events with unresolved flags and overdue events added (previously only Planning events were covered, so an event could pass its date unconfirmed with no prompt).
* 2026-10-01 (audit): beyond Release 1 (label `beyond-release-1`), following the Week 4 not-required list and the team's 13 Sep decision. Showing an event as Overdue moved to SCRUM-82 so it stays in Release 1; AC5 keeps only the reminder.

Functionality Area: Notification System
