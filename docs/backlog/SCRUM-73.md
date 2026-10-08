<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-09. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-73 - Register for an event

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Highest |
| **Story points** | 2 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-73 |

---

**User story:** As an Attendee, I want to register for an event, so that my place is recorded and the organisers know to expect me.

**Acceptance criteria**

1. Given an event is Confirmed and its registration is open, when I register, then a registration linked to me and the event is created and I immediately see it with the status Registered.
2. Places are allocated first come, first served; there is no approval queue and no Organiser decision on individual registrations.
3. Given I already hold an active registration for the event, when I register again, then no second registration is created and I'm told I'm already registered.
4. Registering reduces the event's remaining places by one; capacity rules are in SCRUM-74.
5. Given the event is not Confirmed, or its registration is closed or not yet open, when I register, including by a direct request, then I'm refused and nothing is created.
6. Registration opens when the event is Confirmed (SCRUM-81). An opening time later than confirmation, and when registration closes, are set in SCRUM-75.
7. Given the event goes back to Planning after an approved change, then new registrations are refused until it is Confirmed again; existing registrations stay.

**Business rule:** Organiser discretion controls the registration window through SCRUM-75, not individual attendee approval.

**Change log**

* 2026-10-01 (audit): written as one numbered list. "Enabled when registration needs is Yes" is replaced by "opens when the event is Confirmed (SCRUM-81)": the request form's registration needs is free text, and nothing in the code switched registration on, so only seeded events could take registrations. The cut-off at the event's start moved to SCRUM-75 AC8, which already states it; the merged code doesn't check it yet.

Functionality Area: Attendee Registration
