<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-82 - Close an event: cancel it, or mark it completed once it has passed

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 5 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-82 |

---

**User story:** As an Event Coordinator, I want to cancel an event that will not go ahead, and have events close as Completed after they finish, so that nobody keeps planning, holding resources for, or attending an event that is over.

**Acceptance criteria**

1. Given an event is Under Review, Planning or Confirmed, when its assigned Coordinator cancels it with a reason, then its status becomes Cancelled. The reason is required and visible to anyone who can view the event.
2. The Organiser asks for cancellation through a change request (SCRUM-41); approving it applies this story (SCRUM-128).
3. Cancelling, in the same operation, sets the venue booking or pending venue request to Cancelled, cancels equipment reservations and returns their stock, cancels any open equipment request, sets Registered registrations to Cancelled, rejects any Submitted change request with the cancellation reason, and cancels any Pending handover.
4. A cancelled event cannot be reopened. Starting again means a new request.
5. Use Cancel, not Reject (SCRUM-117), for any event that has ever been Confirmed or has registrations.
6. Cancelling notifies the Organiser and Coordinator (SCRUM-45) and every Attendee whose registration was cancelled (SCRUM-85).
7. Given a Confirmed event's end time has passed, then within 15 minutes its status becomes Completed. At exactly the end time it is still Confirmed.
8. Given an event is already Completed, then checking again changes nothing and sends no second notification.
9. A Cancelled event is never marked Completed.
10. Given an event's start time passes while it is still Under Review or Planning, then it is not completed automatically; it is shown as Overdue in the Coordinator's event list (SCRUM-69) until the Coordinator cancels or rejects it.
11. After completion, every event detail stays as it was and is read-only, except the closure record: the Coordinator can add an attendance headcount, operational notes and issues. Per-Attendee attendance is SCRUM-80 (beyond Release 1).

**Related:** AC7 needs a job that runs every 15 minutes; changes to vercel.json need Jin's approval (CODEOWNERS).

**Customer basis:** "An authorised user can cancel an event. Related venue and equipment reservations should no longer remain committed to a cancelled event." Step 14: "Once the event has taken place, it can be marked as completed. Relevant attendance information, operational notes, or issues may then be recorded and the event can be closed."

**Change log**

* 2026-10-01: completion check frequency stated; Pending handover and pending venue requests added to what cancelling closes; when to cancel instead of reject; attendance clarified as a headcount; cancellation via change request points to SCRUM-128.
* 2026-10-01 (audit): Submitted removed from AC1, because a Submitted event has no Coordinator yet. AC3 names reservations and open equipment requests (the built equipment model) and no longer mentions Waitlisted registrations (SCRUM-79 is beyond Release 1). Overdue events are shown in the Coordinator's list without reminders (SCRUM-122 is beyond Release 1). Group headings removed.

Functionality Area: Event Status Management
