<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-29. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-242 - Chore: List SCRUM-70 under its Access Control epic in product-context's Release 1 feature table

| | |
|---|---|
| **Type** | Task |
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-242 |

---

Found during the SCRUM-218 epic check (AC3). The Release 1 feature table in docs/product-context.md lists SCRUM-70 as a main story of feature #18 Attendee registration (SCRUM-11), but in Jira SCRUM-70 belongs to SCRUM-9 Access Control. The two sources disagree about which epic delivers it.

Decision (29 Oct, Felicia): SCRUM-70 stays in SCRUM-9. Its point is who may see an event's registrations, which is authorisation. The document is fixed to match Jira.

Out of scope: docs/data-model.md's story-to-table map keeps SCRUM-70 against the Registration table, because that map is about which stories use a table, not which epic they belong to.

**Acceptance criteria**

1. In docs/product-context.md's Release 1 feature table, SCRUM-70 is listed under feature #1 (SCRUM-9 Access Control) and no longer under feature #18 (SCRUM-11 Attendee Registration).
2. Jira is unchanged: SCRUM-70's epic stays SCRUM-9.
3. The PR is docs-only, and it reports the result of the attendee e2e specs run against a local database, as evidence for SCRUM-218 AC3 (feature #18 works end to end).
