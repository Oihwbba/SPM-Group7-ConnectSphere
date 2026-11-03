<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-03. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-267 - Chore: Re-sync docs/backlog for SCRUM-156 after its seed names were updated

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-267 |

---

## Why

`docs/backlog/SCRUM-156.md` still calls the seeded `evt_approved` "Approved — Research Symposium" and the Freshman Orientation event "Planning — Freshman Orientation". SCRUM-233 renamed both, and no seeded event stays Approved. TC-233-09 found this, but the file is outside its scope: it's the Jira snapshot of an older story. So the fix went into Jira on 3 Nov (SCRUM-156's seed decision and change log), and the snapshot now has to follow it.

## Done when

1. `docs/backlog/SCRUM-156.md` matches Jira, regenerated from it and not edited by hand.
2. `docs/backlog/README.md` lists this task. As a partial sync, it keeps its last-synced date.
3. Only those files change, so the PR is docs-only.

Related: SCRUM-156, SCRUM-233 (TC-233-09), SCRUM-260.
