<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-20. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-201 - Bug: SCRUM-124's TC-124-02 borrows another suite's equipment and fails at random

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-201 |

---

`tests/integration/staff-notifications.test.ts` (SCRUM-124) picks its equipment with `prisma.equipment.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } })`. Several other integration suites (request-reservation, first-come, report-reservation, equipment-schedule, equipment-availability, concurrency) create throwaway equipment and delete it in `afterAll`. Vitest runs the files in parallel, so the first active equipment can be another suite's throwaway item:

* TC-124-02's equipment request then fails with `EquipmentRequestLine_equipmentId_fkey` when the owning suite deletes it, or
* the owning suite's `prisma.equipment.deleteMany()` cleanup fails because TC-124-02 made a request line on it.

Seen on 2026-10-19: CI on `main` after #233, on #247 once and on #249 three times (none of them touch equipment).

**Acceptance criteria**

1. `staff-notifications.test.ts` creates its own equipment in `beforeAll` and deletes it in `afterAll`, and no longer reads any other suite's equipment.
2. TC-124-02 still proves that the same equipment request sent twice at the same moment tells each Technical Support member once.
3. CI on the fix and on the next pull requests passes without re-runs for this failure.

Related: SCRUM-124, SCRUM-191 (the same class of cross-suite race), SCRUM-193.
