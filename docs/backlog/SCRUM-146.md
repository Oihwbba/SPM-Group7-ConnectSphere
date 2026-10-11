<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-12. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-146 - Remove stale story references

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Low |
| **Story points** | - |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-146 |

---

Clean up placeholder-page and cross-reference drift identified by audit finding F39.

Acceptance criteria:

1. Notifications page references SCRUM-48.
2. My Registrations page references SCRUM-76.
3. Venue Catalogue page references SCRUM-34.
4. Search the app for the obsolete SCRUM-51, SCRUM-42 and SCRUM-21 references in those contexts and replace only incorrect story references.
5. Add a lightweight verification/search step so stale IDs are not reintroduced.
6. Comments in `prisma/schema.prisma`, `prisma/seed.ts` and the tests cite only story keys that exist, or say which story replaced a merged or dropped one. Applied migrations are not edited, because Prisma flags a changed applied migration.

Related: SCRUM-48, SCRUM-76, SCRUM-34.

Change log

* 2026-10-12: AC6 adds the stale keys the design-pack audit found (item B3): SCRUM-33, 35, 39, 42, 43, 44, 46, 47, 51, 54, 57, 78 and 83 in schema.prisma comments, seed.ts and one test. Added to Sprint 3.
