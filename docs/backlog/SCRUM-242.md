<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-29. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-242 - Chore: Match the docs to Jira's epics for SCRUM-70 (Access Control) and SCRUM-212 (Attendee Registration)

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

Found during the SCRUM-218 epic check (AC3, AC4). The repo disagrees with Jira about which epic two stories belong to:

* The Release 1 feature table in docs/product-context.md lists SCRUM-70 as a main story of feature #18 Attendee registration (SCRUM-11), but in Jira SCRUM-70 belongs to SCRUM-9 Access Control.
* SCRUM-212 belongs to SCRUM-11 Attendee Registration in Jira, but the feature table doesn't list it under feature #18, and docs/backlog (synced 21 Oct, before it was linked) still files it under "Stories with no epic".

The same check (AC4) found that SCRUM-80 and SCRUM-115 didn't say why they are beyond Release 1, and that SCRUM-115's 1 Oct change log still said SCRUM-79 is in Release 1. Both were fixed in Jira on 29 Oct; docs/backlog still shows the old text.

Decision (29 Oct, Felicia): SCRUM-70 stays in SCRUM-9, because its point is who may see an event's registrations, which is authorisation. SCRUM-212 stays in SCRUM-11. Jira is right in both cases, so the documents are fixed to match it.

Out of scope: docs/data-model.md's story-to-table map keeps SCRUM-70 against the Registration table, because that map is about which stories use a table, not which epic they belong to.

**Acceptance criteria**

1. In docs/product-context.md's Release 1 feature table, SCRUM-70 is listed under feature #1 (SCRUM-9 Access Control) and no longer under feature #18 (SCRUM-11 Attendee Registration).
2. The same table lists SCRUM-212 under feature #18 (SCRUM-11).
3. docs/backlog/SCRUM-212.md is re-synced from Jira, and the backlog index lists SCRUM-212 under SCRUM-11 instead of "Stories with no epic".
4. Jira is unchanged: SCRUM-70's epic stays SCRUM-9 and SCRUM-212's stays SCRUM-11.
5. The PR is docs-only, and it reports the result of the attendee e2e specs run against a local database, as evidence for SCRUM-218 AC3 (feature #18 works end to end).
6. docs/backlog/SCRUM-80.md and SCRUM-115.md are re-synced from Jira, so each gives its reason for the beyond-release-1 label (SCRUM-218 AC4).

**Change log**

* 2026-10-29: SCRUM-212 added (AC2, AC3); the old AC2 and AC3 are now AC4 and AC5.
* 2026-10-29: SCRUM-80 and SCRUM-115 re-sync added (AC6), after their beyond-release-1 reasons were written in Jira.
