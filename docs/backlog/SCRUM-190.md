<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-190 - An event takes place within one day

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Medium |
| **Story points** | 2 |
| **Status in Jira** | To Do |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-190 |

---

**User story:** As an Event Organiser, I want to enter my event as one date with a start and an end time, so that I only request events ConnectSphere can actually book and confirm.

**Acceptance criteria**

1. The request form (SCRUM-13) asks for one event date, a start time and an end time, in Singapore time (SCRUM-129), instead of a start date/time and an end date/time.
2. Given the end time is not after the start time, then submission is blocked and the time range is reported as invalid. The end time can be any time up to 24:00, which means midnight at the end of the event's date; 00:00 is not offered as an end time.
3. The same rule applies wherever an event's date or time is set after the form: submitting (SCRUM-14), resubmitting an amended request (SCRUM-108), a change request (SCRUM-41 AC4) and the Coordinator's direct edit (SCRUM-25 AC3). A draft can still be saved without a date or times (SCRUM-15).
4. Given a request whose period runs over more than one day reaches the server, including one that bypasses the form, then it is refused with the same message as AC2 and nothing is saved. A period ending exactly at midnight at the end of its date counts as one day.
5. Given an event saved before this story spans more than one day, then its dates are kept and shown as they are, and the event page tells the Coordinator it can't be booked until its date and time fit one day. The Coordinator can change them (SCRUM-25 AC3) or reject the event as unfulfillable (SCRUM-117). Changing its date or time must meet AC2.

**Supersedes:** SCRUM-13 AC1 (separate proposed start and end date/time) and extends SCRUM-13 AC8 (date range).

**Customer basis:** team decision; no customer answer requires multi-day events, and the customer's worked example is within one day (Week 7 change 1: "an event scheduled from 10:00am to 12:00pm"). A multi-day event can't be fulfilled today: every venue has opening hours (SCRUM-34 AC3), a booking period must start and end within one day's opening hours (SCRUM-34 AC7, a team decision), a booking must use the event's whole period (SCRUM-50, SCRUM-162, SCRUM-188), and Confirm needs an Approved booking covering that period (SCRUM-110). This story moves that dead end to the request form, where the Organiser can fix it.

**Why this is a new story:** SCRUM-13 (Sprint 1, Done) captures separate start and end dates, so an Organiser can submit an event that no venue can be booked for. Done stories are not reopened, so the change lives here.

**Change log**

* 2026-10-17: created from SCRUM-38 development (proposed by Felicia Or), for the PO to approve. Related edits proposed to https://smu-spm-group7.atlassian.net/browse/SCRUM-38.
* 2026-10-21 (for the PO to approve): AC2 says how midnight is entered (24:00). AC4 drops the SCRUM-67 reference, which is about roles. AC5 gives legacy multi-day events a way out (SCRUM-25 AC3, SCRUM-117).

Functionality Area: Event Request Creation
