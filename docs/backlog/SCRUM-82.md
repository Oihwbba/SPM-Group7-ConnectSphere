<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-08. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-82 - Close an event: cancel it, or mark it completed once it has passed

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 5 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-82 |

---

**User story:** As an Event Coordinator, I want to cancel an event that will not go ahead, and have events close as Completed after they finish, so that nobody keeps planning, holding resources for, or attending an event that is over.

**Acceptance criteria**

1. Given an event is Under Review, Planning or Confirmed, when its assigned Coordinator cancels it with a reason, then its status becomes Cancelled. The reason is required and visible to anyone who can view the event.
2. The Organiser asks for cancellation through a change request (SCRUM-41); approving it applies this story (SCRUM-128).
3. Cancelling, in the same operation, sets every venue booking, hold and pending venue request of the event to Cancelled, cancels equipment reservations and returns their stock, cancels any open equipment request, closes any safety check awaiting review (SCRUM-166), sets Registered registrations to Cancelled, and rejects any Submitted change request with the cancellation reason.
4. A cancelled event cannot be reopened. Starting again means a new request.
5. Use Cancel, not Reject (SCRUM-117), for any event that has ever been Confirmed or has registrations.
6. Cancelling notifies the Organiser and Coordinator (SCRUM-45) and every Attendee whose registration was cancelled (SCRUM-85).
7. Given a Confirmed event's end time has passed, then it shows as Completed everywhere from that moment, without a scheduled job: the status is saved the first time the event is read or changed after its end, and the completion notice (SCRUM-45) is written when the event is confirmed with a show-from time of its end (SCRUM-48), and withdrawn if the event is cancelled or returns to Planning first. At exactly the end time it is still Confirmed.
8. Given an event is already Completed, then checking again changes nothing and sends no second notification.
9. A Cancelled event is never marked Completed.
10. Given an event's start time passes while it is still Submitted, Under Review or Planning, then it is not completed automatically; it is shown as Overdue in the Coordinator's event list (SCRUM-69), or in the Lead's queue while no Coordinator is assigned (SCRUM-165), until it is cancelled or rejected. An unassigned request is first assigned by the Lead; its Coordinator then cancels or rejects it.
11. After completion, every event detail stays as it was and is read-only, except the closure record: the Coordinator can add an attendance headcount, operational notes and issues. Per-Attendee attendance is SCRUM-80 (beyond Release 1).

**Related:** there is no scheduler. Graders run the app on their own machines and deployments go through GitHub Actions, so AC7 works without a job, the same way hold expiry does (SCRUM-163).

**Customer basis:** "An authorised user can cancel an event. Related venue and equipment reservations should no longer remain committed to a cancelled event." Step 14: "Once the event has taken place, it can be marked as completed. Relevant attendance information, operational notes, or issues may then be recorded and the event can be closed."

**Change log**

* 2026-10-01: completion check frequency stated; Pending handover and pending venue requests added to what cancelling closes; when to cancel instead of reject; attendance clarified as a headcount; cancellation via change request points to SCRUM-128.
* 2026-10-01 (audit): Submitted removed from AC1, because a Submitted event has no Coordinator yet. AC3 names reservations and open equipment requests (the built equipment model) and no longer mentions Waitlisted registrations (SCRUM-79 is beyond Release 1). Overdue events are shown in the Coordinator's list without reminders (SCRUM-122 is beyond Release 1). Group headings removed.
* 2026-10-07 (Week 7 changes 3 to 6): AC3 releases every venue booking, hold and pending request (SCRUM-162, SCRUM-163), closes a safety check awaiting review (SCRUM-166), and no longer mentions a Pending handover, because the Lead now reassigns at once (SCRUM-21). AC7 and the Related note complete an event without a scheduled job, replacing the 15-minute job. AC10 also shows overdue unassigned requests in the Lead's queue (SCRUM-165).
* 2026-10-07 (backlog refinement): AC10 says an overdue unassigned request is assigned by the Lead before its Coordinator cancels or rejects it, because nobody can do either while it has no Coordinator (SCRUM-135 AC4 and AC9).

Functionality Area: Event Status Management
