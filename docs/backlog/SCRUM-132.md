<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-132 - Core pages work on a phone and respond within 2 seconds

| | |
|---|---|
| **Type** | Story |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | 3 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-132 |

---

**User story:** As any ConnectSphere user, I want the main pages to work on my phone and respond quickly, so that staff can use the system while setting up a venue and external users can use it without training.

**Acceptance criteria**

1. These pages are usable at 360 px width with no horizontal scrolling: sign-in, My Event Requests, event detail, request form, venue search, venue availability, booking review, equipment review, all-events list, event browse, my registrations and notifications.
2. With a test dataset sized for three years of growth (2,000 events, 50 venues, 200 equipment types, 20,000 registrations), these operations respond within 2 seconds at the 95th percentile: view an event, search venues, open a venue's availability, check equipment availability, submit a registration.
3. On the event detail page, the status, confirmed arrangements and outstanding actions are visible without scrolling on a desktop screen.
4. Every action that changes data shows a confirmation message, and every validation error says which field to fix and how.
5. The measurements in AC1 and AC2 are run once per sprint and attached to the sprint review evidence.

**Customer basis:** Briefing §7 ("desktop- and mobile-friendly… staff may need access while preparing event spaces or equipment"), §8a performance, §8c usability, §8e scalability ("anticipated growth over the next three years").

**Why this is a new story:** none of these non-functional requirements had a story, acceptance criterion or Definition of Done entry. The dataset size is a team estimate; confirm at the next customer Q&A.

**Change log**

* 2026-10-01 (audit): AC1 lists the all-events list (SCRUM-141) instead of the event calendar (SCRUM-120, beyond Release 1).
