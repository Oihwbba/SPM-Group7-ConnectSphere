<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-27. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-229 - Bug: Equipment availability shows a result for an invalid quantity, and Coordinator equipment lists include unassigned events

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | 1 |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-229 |

---

Two low findings from the SCRUM-10 epic code review (26 Oct).

**1. SCRUM-29 AC7:** "Given a quantity of zero or less … then the check is rejected as invalid and no result is shown." On Equipment, an invalid quantity drops the available/short verdict, but the "X of Y available" figure stays. A quantity like "1.5" or "2abc" is read as 1 or 2 instead of being refused.

**2. SCRUM-165 AC8:** "a Coordinator acts only on the events assigned to them." `coordinatorEventScope` in `lib/equipment/request-queries.ts` says it must mirror `can()`, but it also matches every non-draft event with no Coordinator. So the Coordinator's equipment request list and the New request event picker include unassigned events, which `createEquipmentRequest` then refuses. Nothing leaks today, because unassigned events are Submitted ones with no requests, but the list and the rule disagree.

**Acceptance criteria**

1. Given the quantity on the availability check is not a positive whole number (0, a negative number, a decimal, or text), then the check shows no figure and no verdict, only that the quantity is invalid.
2. Given a valid quantity, the availability check is unchanged.
3. A Coordinator's equipment request list and New request event picker show only events assigned to them, exactly as `can()` decides.
4. Tests cover both, and fail without the fix.
