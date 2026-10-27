<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-27. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-228 - Chore: Make SCRUM-170's race test wait for its locks instead of sleeping

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | 0 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-228 |

---

Found in the 27 Oct audit of the equipment tests. `tests/integration/equipment-decision.test.ts`'s race test (No equipment needed recorded while an equipment request is created, SCRUM-170 AC4) uses fixed sleeps: it waits 200 ms for its own transaction to take the event row, then 300 ms for the request to queue behind it.

On a slow CI runner the first 200 ms may not be enough. The request then takes the event first, the decision is recorded after it, and the test fails although the code is right. If the second wait is too short, the test passes without testing the interleaving at all.

**Acceptance criteria**

1. The test starts the request only once its own transaction holds the event row, and commits only once the request is queued behind that lock, without fixed sleeps.
2. It still checks the same outcome: the request is created, and No equipment needed is cleared.
3. It passes on repeated runs, and still fails if `createEquipmentRequest` stops locking the event.

Related: SCRUM-170 AC4, SCRUM-204, SCRUM-227 (the same lock-queue technique).
