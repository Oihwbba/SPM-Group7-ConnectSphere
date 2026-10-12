<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-11. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-48 - User views their notification list

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-8 - Event Change & Notifications |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-48 |

---

**User story:** As any ConnectSphere user, I want to see a list of my notifications, so that I can catch up on updates I missed.

**Acceptance criteria**

1. Given I have notifications, when I open my notification list, then all of them are shown, newest first.
2. Given I open an unread notification, then it is marked as read.
3. The header shows my unread count, and it updates when I read a notification.
4. Given I have no notifications, then an empty-state message is shown rather than an error.
5. Each notification links to a page I am allowed to open: internal users and Organisers go to the event page, and a Safety Officer goes to the safety check (SCRUM-166); Attendees go to the Attendee view of the event (SCRUM-72, or SCRUM-85 while it is being re-planned).
6. I only ever see my own notifications. A user with several roles (SCRUM-121) sees the notifications for all their roles in one list.
7. Notifications from every source (SCRUM-45, SCRUM-85, SCRUM-124, and the equipment-request updates SCRUM-28 sends) appear in this one list.
8. Given a notification has a show-from time, such as a hold's 24-hour reminder (SCRUM-163), then it neither appears nor counts as unread before that time, and appears from that time on without any other action. Given it is withdrawn before that time, then it never appears.

**Related:** the Sprint 1 and 2 code already creates notifications (assignment, clarification, equipment-request updates), so this list is the first place users can read them. The Notifications placeholder page in the code still names SCRUM-51; it should name this story.

**Customer basis:** "The notification delivery channel is up to your implementation (can be in-app or external)." Week 7 change 4: "The Event Coordinator should be informed before or when the hold expires."

**Change log**

* 2026-10-01: added the link-target rule, the multi-role rule and the list of notification sources.
* 2026-10-01 (verification pass): removed SCRUM-79 from the source list.
* 2026-10-01 (audit): removed SCRUM-122 from the sources (beyond Release 1) and added the equipment-request updates SCRUM-28 already sends.
* 2026-10-07 (Week 7 changes 4 and 6): AC8 adds notifications with a show-from time, so hold reminders work without a scheduler (SCRUM-163). AC5 sends a Safety Officer to the safety check (SCRUM-166).
* 2026-10-07 (backlog refinement): AC5 points to SCRUM-85, which SCRUM-133 was merged into.

Functionality Area: Notification System
