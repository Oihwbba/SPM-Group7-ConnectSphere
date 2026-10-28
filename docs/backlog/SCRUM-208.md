<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-28. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-208 - One page per event, not a pop-up

| | |
|---|---|
| **Type** | Story |
| **Epic** | - |
| **Priority** | High |
| **Story points** | 2 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-208 |

---

**User story:** As an Organiser or Coordinator, I want each event on its own page, so that I can see everything about it in one place and share its link.

**Acceptance criteria**

1. Opening an event from my list goes to its own page with its own URL; the pop-up is removed.
2. The top of the page shows the status, the assigned Coordinator and the single next action needed, from the readiness checklist.
3. The rest of the page is in the order the work happens: request details, clarification, venues, equipment, safety check, changes and flags, registrations, notes.
4. A section I can't act on is read-only, and a section with nothing in it yet says so in one line.
5. Opening another person's event, or one that doesn't exist, gives the same not-found page (SCRUM-68).

**Customer basis:** Briefing, design: "current status, confirmed arrangements, and outstanding actions should be easy for the relevant user to understand"; usability: "without extensive training."

**Why this is a new story:** today the Organiser and the Coordinator see an event only in a pop-up on the events list (event-details-modal.tsx) holding about twelve panels. Done stories are not reopened; this story moves those panels onto a page.

**Related:** SCRUM-207 (page conventions) first. Every rule the panels enforce today still applies. Updates the e2e specs that open the pop-up.

**Change log**

* 2026-10-21: created at Sprint 3 review for Sprint 4 (UI revamp U2). Owner Caylern.

Functionality Area: Event Information Management, Event Status Management
