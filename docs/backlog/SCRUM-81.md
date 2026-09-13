<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-81 - Move an approved event through planning to confirmed

| | |
|---|---|
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Highest |
| **Story points** | 5 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-81 |

---

**As ConnectSphere**, I want an approved event to move automatically into planning and then to confirmed once its venue booking (and equipment reservation, if one was requested) are both in place, so that the event reaches a state where Attendees can actually register for it.

**Acceptance Criteria:**

* Given an event's request is approved, when the approval is saved, then the event's status changes to "planning" in the same action (no separate manual step)
* Given an event in planning has an approved venue booking and either has no equipment request or has a confirmed equipment reservation, when the last of these conditions is met, then the event's status changes to "confirmed"
* Given an event in planning whose venue booking is rejected, when the rejection is saved, then the event remains in planning (does not silently advance), and the Coordinator can submit a new booking request
* Given an event has no stated venue requirement at all, this story treats a venue booking as required before confirmation
* Two users viewing the same event at the same time never see conflicting statuses (same single-source-of-truth rule as SCRUM-24)

**Customer clarification (2026-09-13) — confirms the two gates:** _"Approval = sufficient info for planning. Confirmation = essential arrangements completed."_

This is the customer's own definition and it matches what the story already did:

* **Approval** is a judgement about the _request_ — is there enough information to start planning. It does not assert that anything has been booked.
* **Confirmation** is a fact about the _arrangements_ — the essential ones are complete. This story's reading of "essential" is: an approved venue booking, plus a confirmed equipment reservation where equipment was requested.

The fourth criterion previously carried "an open question for the customer, see the Q&A doc" about events with no venue requirement. The customer's phrasing — _essential_ arrangements — does not settle whether a venue is essential for every event, so the default is unchanged and the question stays open. It is narrow enough not to block the story.

**Note:** this closes the gap SCRUM-24 flagged from the start. Directly unblocks SCRUM-70, 72 and 73, all of which gate on the event being "confirmed".

Functionality Area: Event Status Management
