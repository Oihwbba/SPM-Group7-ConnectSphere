<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-28. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-234 - Chore: Add the missing e2e journeys for SCRUM-142 AC5 and SCRUM-26's flagged reservation

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | 0 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-234 |

---

Found in the 27 Oct e2e coverage analysis. CONTRIBUTING asks for each journey's success path and at least one failure path in Playwright. Two equipment journeys have neither in e2e; only unit and integration tests cover them.

1. **SCRUM-142 AC5:** once an event is Confirmed, its Coordinator is no longer offered Change lines or Withdraw on its equipment request, or Withdraw on its venue request. Changes go through a change request.
2. **SCRUM-26 AC8, AC9:** a flagged _reservation_ is resolved by its Coordinator. Still stands is refused when the event's reservations no longer cover what its requests need, and Cancel arrangement releases the stock. The e2e tests only resolve flagged venue bookings.

**Acceptance criteria**

1. An e2e test shows a Confirmed event's Coordinator is offered neither Change lines nor Withdraw for its equipment request, nor Withdraw for its venue request, and that nothing changes (TC-142-09).
2. An e2e test shows Still stands refused for a flagged reservation that no longer covers its request, with the reason, and Cancel arrangement then cancelling it (TC-26-08, TC-26-10).
3. Both are cited from `docs/testing/SCRUM-142.md` and `SCRUM-26.md`, and the index rows say e2e.
4. Both pass locally against the local database and in CI.
