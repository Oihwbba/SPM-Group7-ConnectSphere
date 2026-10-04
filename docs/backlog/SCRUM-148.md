<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-04. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-148 - Close or rework obsolete equipment PR

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Low |
| **Story points** | - |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-148 |

---

Resolve the stale implementation referenced by audit finding F38.

Acceptance criteria:

1. Review PR #37 / the old SCRUM-32 implementation that lets Technical Support directly change or cancel reservations.
2. If obsolete, close it with a note pointing to the current SCRUM-32 and SCRUM-26 model.
3. If useful code is retained, rework it so Technical Support reports unavailable equipment and the Coordinator resolves the Needs Reconsideration flag.
4. No path allows Technical Support to cancel a reservation or change its quantity/period directly.

Related: SCRUM-32, SCRUM-26, SCRUM-124.
