<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-82 - Close an event: cancel it, or mark it completed once it has passed

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 3 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-82 |

---

**User story:** As an Event Coordinator, I want to cancel an event that will not go ahead, and have events close as Completed after they finish, so that nobody keeps planning, holding resources for, or attending an event that is over.

**Acceptance criteria**

1. Given an event is Under Review, Planning or Confirmed, when its assigned Coordinator cancels it with a reason, then its status becomes Cancelled. The reason is required and visible to anyone who can view the event.
2. The Organiser asks for cancellation through a change request (SCRUM-41); approving it applies this story (SCRUM-128).
3. Cancelling, in the same operation, sets every venue booking, hold and pending venue request of the event to Cancelled, cancels equipment reservations and returns their stock, cancels any open equipment request, makes any safety check awaiting review Outdated (SCRUM-166), sets Registered registrations to Cancelled, and rejects any Submitted change request with the cancellation reason.
4. A cancelled event cannot be reopened. Starting again means a new request.
5. Use Cancel, not Reject (SCRUM-117), for any event that has ever been Confirmed or has registrations.
6. Cancelling notifies the Organiser and Coordinator (SCRUM-45) and every Attendee whose registration was cancelled (SCRUM-85).
7. Given a Confirmed event's end time has passed, then it shows as Completed everywhere from that moment, without a scheduled job: the status is saved the first time the event is read or changed after its end. At exactly the end time it is still Confirmed.
8. Given an event is already Completed, then checking again changes nothing.
9. A Cancelled event is never marked Completed.
10. Given an event's start time passes while it is still Submitted, Under Review or Planning, then it is not completed automatically; it is shown as Overdue in the Coordinator's event list (SCRUM-69), or in the Lead's queue while no Coordinator is assigned (SCRUM-165), until it is cancelled or rejected. An unassigned request is first assigned by the Lead; its Coordinator then cancels or rejects it.
11. Given a Confirmed event completes (AC7) while a change request for it is still Submitted, then that request is rejected in the same operation with the reason "The event has already taken place", and the Organiser is notified of the outcome (SCRUM-45).

**Related:** there is no scheduler. Graders run the app on their own machines and deployments go through GitHub Actions, so AC7 works without a job, the same way hold expiry does (SCRUM-163).

**Customer basis:** Problem with the current process that the customer wants fixed: "Cancelled events may continue to occupy venue or equipment reservations." Step 14: "Once the event has taken place, it can be marked as completed. Relevant attendance information, operational notes, or issues may then be recorded and the event can be closed."

**Change log**

* 2026-10-01: completion check frequency stated; Pending handover and pending venue requests added to what cancelling closes; when to cancel instead of reject; attendance clarified as a headcount; cancellation via change request points to SCRUM-128.
* 2026-10-01 (audit): Submitted removed from AC1, because a Submitted event has no Coordinator yet. AC3 names reservations and open equipment requests (the built equipment model) and no longer mentions Waitlisted registrations (SCRUM-79 is beyond Release 1). Overdue events are shown in the Coordinator's list without reminders (SCRUM-122 is beyond Release 1). Group headings removed.
* 2026-10-07 (Week 7 changes 3 to 6): AC3 releases every venue booking, hold and pending request (SCRUM-162, SCRUM-163), closes a safety check awaiting review (SCRUM-166), and no longer mentions a Pending handover, because the Lead now reassigns at once (SCRUM-21). AC7 and the Related note complete an event without a scheduled job, replacing the 15-minute job. AC10 also shows overdue unassigned requests in the Lead's queue (SCRUM-165).
* 2026-10-07 (backlog refinement): AC10 says an overdue unassigned request is assigned by the Lead before its Coordinator cancels or rejects it, because nobody can do either while it has no Coordinator (SCRUM-135 AC4 and AC9).
* 2026-10-08 (PO review): Customer basis now quotes the current-process problem from the briefing's Background section instead of the archived Week 1 table.
* 2026-10-09 (PO review): AC11 removed (closure record): Step 14 only says attendance, notes or issues "may" be recorded, Completed events are locked by SCRUM-41 AC2 and SCRUM-25 AC1, and notes stay available through SCRUM-25 AC6. The completion notification removed from AC7 and AC8, because it isn't in the Week 4 notification list. Re-estimated from 5 to 3.
* 2026-10-11 (PO review): AC3 makes a safety check awaiting review Outdated instead of "closing" it, because Outdated is one of SCRUM-166's states.
* 2026-10-18 (PO approved): new AC11 (unrelated to the closure-record AC11 removed on 2026-10-09). Completing an event rejects any still-Submitted change request, as cancelling does (AC3), so an Organiser's request never stays Submitted on an event that is over. Raised by the SCRUM-128 GLM review (PR #181). No re-estimate: it is one more write in AC7's existing completion step.

Functionality Area: Event Status Management
