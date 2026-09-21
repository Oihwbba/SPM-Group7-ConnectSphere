<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-80 - Record attendance on the day

| | |
|---|---|
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Low |
| **Story points** | 3 |
| **Status in Jira** | To Do|
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-80 |

---

**BEYOND FIRST RELEASE — backlog only, do not pull into a sprint without customer confirmation.**

**As an Event Coordinator**, I want to record which registered Attendees actually attended, so that ConnectSphere has accurate figures for reporting and for planning similar future events.

**Acceptance Criteria:**

- A Coordinator can mark a registration as attended or not attended on or after the event date
- Attendance cannot be recorded before the event's start time
- Attendance figures are visible alongside registration figures for the event
- Attendance for a withdrawn registration cannot be recorded

**Note:** appears in the Week 1 briefing's feature areas but not among the twenty core Release-1 features. Backlog only, same reasoning as the waitlist story. It feeds the reporting features, which are themselves out of first-release scope.

**INVEST:** Independent (needs "Register for an event"); Negotiable (self check-in versus coordinator marking is entirely undecided); Valuable (to reporting, which is not in Release 1); Estimable and Small (one flag per registration); Testable (assert the date constraint and the withdrawn-registration constraint).

Functionality Area: Attendee Registration (beyond first release)
