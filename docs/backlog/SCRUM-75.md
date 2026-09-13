<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-13. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-75 - Control and enforce the registration period

| | |
|---|---|
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Medium |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-75 |

---

**As an Event Organiser**, I want to control when registration opens and closes, and **as an Attendee** I want that window enforced, so that nobody registers for an event that has closed or has not yet opened.

**Acceptance Criteria — Organiser control**

* The Organiser sets the registration opening and closing instants for their event. Registration cannot open before the event is confirmed
* **Given an open registration period, when the Organiser extends the closing instant, then registration reopens or stays open to the new instant**
* **Given an open registration period, when the Organiser closes registration manually, then it closes immediately regardless of the stated closing instant**
* Given a registration period whose closing instant is earlier than or the same as its opening instant, when it is saved, then it is rejected as an invalid period

**Acceptance Criteria — enforcement**

* Given the current time is before the registration period opens, when an Attendee views the event, then the register action is unavailable and the opening date is shown
* Given the current time is at or after the opening instant and at or before the closing instant, when an Attendee registers, then registration is accepted
* Given the current time is exactly the opening instant, when an Attendee registers, then registration is accepted — the window is inclusive of its opening moment
* Given the current time is exactly the closing instant, when an Attendee registers, then registration is accepted — the window is inclusive of its closing moment, and closes immediately after it
* Given the current time is after the registration period closes, when an Attendee views the event, then the register action is unavailable and the event is shown as closed
* Given the registration period has closed, when a registration request is submitted directly, then it is refused
* Given an event with no registration period set, when an Attendee views it, then registration is available while the event remains confirmed

**Customer clarification (2026-09-13):**

* _"Registration may opens once event is confirmed; organiser control timing."_
* _"Registration period can be extended; waiting list supported. At the moment closure is based on Organiser discretion and manually close the registration. The team may propose other better approach."_

This **widens** the story. It previously only enforced a window that someone else set; the customer has made setting, extending and manually closing that window an Organiser capability, so the story now has two halves and a new title. The four Organiser-control criteria are new.

**⚠ Re-estimate before continuing.** Sized at 2 points as "two time comparisons". It now includes Organiser-facing controls. Bring it to planning poker — and consider splitting the Organiser-control half into its own story if it grows past 3.

**⚠ The "waiting list supported" half of that answer is NOT actioned here.** It conflicts with the Week 4 not-required list — see the comment on SCRUM-79.

**Note (2026-09-07):** the previous final criterion said only that boundary moments were "treated consistently and documented" - which stated an intention rather than a behaviour and could not be tested. It is replaced by the explicit inclusive-at-both-ends rule above, following the Week 2 assignment feedback.

Functionality Area: Attendee Registration
