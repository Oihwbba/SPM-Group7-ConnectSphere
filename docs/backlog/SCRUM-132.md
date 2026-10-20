<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-132 - Core pages work on a phone and respond within 2 seconds

| | |
|---|---|
| **Type** | Story |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | 2 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-132 |

---

**User story:** As any ConnectSphere user, I want the main pages to work on my phone and respond quickly, so that staff can use the system while setting up a venue and external users can use it without training.

**Acceptance criteria**

1. These pages are usable at 360 px width with no horizontal scrolling: sign-in, My Event Requests, event detail, request form, venue search, venue availability, booking review, equipment review, all-events list, event browse, my registrations, notifications, the Lead's Unassigned queue (SCRUM-165) and the safety review page (SCRUM-166).
2. With the seed data, these operations respond within 2 seconds: view an event, search venues, open a venue's availability, check equipment availability, submit a registration. The timings are run once per sprint and attached to the sprint review evidence.
3. On the event detail page, the status, confirmed arrangements and outstanding actions are visible without scrolling on a desktop screen.
4. Every action that changes data shows a confirmation message, and every validation error says which field to fix and how.
5. Release 1 is not load-tested for three years of growth (§8e). The README states this, together with the design choices that support growth.

**Customer basis:** Briefing §7 ("desktop- and mobile-friendly… staff may need access while preparing event spaces or equipment"), §8a performance, §8c usability, §8e scalability ("anticipated growth over the next three years").

**Why this is a new story:** none of these non-functional requirements had a story, acceptance criterion or Definition of Done entry. 360 px and 2 seconds are the team's own test limits; the briefing gives no numbers.

**Change log**

* 2026-10-01 (audit): AC1 lists the all-events list (SCRUM-141) instead of the event calendar (SCRUM-120, beyond Release 1).
* 2026-10-07 (Week 7 changes 5 and 6): AC1 adds the Lead's Unassigned queue (SCRUM-165) and the safety review page (SCRUM-166).
* 2026-10-08 (backlog refinement, PO approved): re-estimated from 3 to 2 points. The briefing gives no dataset size or limits, so the 2,000-event load test is dropped: AC2 times the operations on the seed data, once per sprint, and AC5 states that growth over three years isn't load-tested in Release 1. 360 px and 2 seconds are kept as the team's own test limits so the criteria stay testable.
