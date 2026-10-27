<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-27. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-227 - Bug: Two simultaneous updates to one equipment request can both be saved when one is a suggestion

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | 1 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-227 |

---

Found in the SCRUM-10 epic code review (26 Oct). SCRUM-28 AC7: "Given two Technical Support Staff update the same request at the same moment, then only the first update is saved and the other is told to refresh."

Status moves are safe: each is written only if the status is still what the reviewer saw. A suggestion (SCRUM-28 AC4) is written only on condition that the request is still In Review, so two staff suggesting on the same request at the same moment are both saved: the second overwrites the first, and the Coordinator gets two notices. A suggestion followed at once by an approval is also both saved. TC-28-06 covers only two status moves.

Also: `docs/testing/SCRUM-28.md` cites two e2e test titles that SCRUM-207 renamed (it appended ", SCRUM-207 TC-207-24"), so 7 citations name tests that no longer exist.

**Acceptance criteria**

1. Given two updates to the same request (a status move or a suggestion, in any combination) are made at the same moment, then only the first is saved, the other is told to refresh, and nothing is written or notified twice.
2. A single update on its own works exactly as before.
3. Tests cover two suggestions at once and a suggestion with a status move at once, and fail without the fix.
4. `docs/testing/SCRUM-28.md` cites the current test titles.

Related: SCRUM-28 AC4, AC5, AC7; ADR 0006 (conditional writes).
