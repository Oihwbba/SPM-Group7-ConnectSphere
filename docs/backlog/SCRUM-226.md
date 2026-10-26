<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-27. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-226 - Bug: Two Technical Support staff can reserve the same line of an approved request twice

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | 1 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-226 |

---

Found in the SCRUM-10 epic code review (26 Oct). SCRUM-155 AC5 says "the same request is never reserved twice", and AC6 says reserving it again is refused.

`reserveEquipmentRequest` locks the event, the request and the equipment, but then checks only that the request still has _something_ outstanding. It doesn't check that the rows submitted are what's still outstanding. Example: two staff open a request whose Mic and Speaker lines are both unreserved. A reserves only the Mic (removing the Speaker row). B then submits Mic and Speaker, and is accepted because Speaker is still outstanding. The Mic is now reserved twice. The `requestVersion` check doesn't catch this, because reserving doesn't change the request's `updatedAt`.

**Acceptance criteria**

1. Given what is still to reserve on a request has changed since the reserve form loaded it (another reservation was made for it or its event, or its lines changed), when I reserve, then nothing is reserved and I'm told the request has changed and to choose it again.
2. Given nothing changed since the form loaded, reserving works exactly as before, including the edits SCRUM-155 AC2 allows (lengthening the period, changing a row's type or quantity, removing or adding a row).
3. A test reproduces the two-staff case above and fails without the fix.

Related: SCRUM-155 AC2, AC5, AC6; SCRUM-156 AC5 (per-line rule).
