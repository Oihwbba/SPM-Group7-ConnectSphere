<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-205 - Bug: Accessibility and error-page gaps found in the 20 Oct audit

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-205 |

---

The 20 Oct audit ran axe (WCAG 2.1 AA) on 61 page views across eight roles.

**What it found**

1. Status badges and muted labels at 4.2:1 contrast, below 4.5:1 (43 instances on My Events).
2. The availability week grid scrolls but can't be reached by keyboard.
3. The Venue Staff booking cards put `dt`/`dd` outside a valid `dl` group, so screen readers lose the label–value pairs.
4. No page heading on the attendee's Browse Events or Tech Support's Equipment pages.
5. No `error.tsx`, so a page whose server work fails shows Next's generic error screen.

**Acceptance criteria**

1. axe reports no violations on any page view in the same crawl.
2. The week grid is a named, focusable region.
3. A page whose server work fails shows a page that says it couldn't load, offers Try again, and gives a reference to quote.
4. Nothing else changes on screen beyond the darker muted text and today's date in bold.

Related: SCRUM-16 (badges), SCRUM-36 (calendar), SCRUM-53 (booking cards), SCRUM-72 and SCRUM-31 (pages).
