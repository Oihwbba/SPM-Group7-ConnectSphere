<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-01. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-261 - Bug: Reserving equipment is refused when the earlier requests it waits for never run at the same time

| | |
|---|---|
| **Type** | Task |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-261 |

---

Before Technical Support reserve stock for a request, SCRUM-134 AC5 refuses the reservation when it "would leave too little of that type for an earlier open request whose event overlaps". Equipment is a counted pool, so what matters is how much is in use at the busiest single moment, not the total of everything that touches the period (SCRUM-29; `lib/equipment/availability.ts` explains why).

The AC5 check (`reserveEquipmentRequest`, `app/(app)/equipment/actions.ts`) adds up what every earlier overlapping request still needs, even when those requests don't overlap each other, and compares the total with what is free at the busiest moment. SCRUM-134's criteria are right as written; the code reads them as a sum.

**Example:** a pool of 10 projectors, nothing reserved. Request A (9–10am) needs 4 and was submitted first; request B (2–3pm) needs 4 and was submitted second; request C (9am–3pm) asks for 5. The check adds A and B to 8, sees 10 − 5 = 5 left, and refuses C. But A and B never run at the same time: at 9am, A's 4 and C's 5 make 9, and at 2pm, B's 4 and C's 5 make 9. Both fit in 10, so C should be reserved.

**Acceptance criteria**

1. Given earlier open requests for the same type whose events overlap the reservation's period, then what each still needs counts only while its event runs: the reservation is refused only if, at some moment of its period, it would leave less free than the earlier requests running at that moment still need. In the example above, C is reserved.
2. Given earlier requests whose events overlap each other at a moment of the period, then what they still need at that moment is added together, as now: a quantity one too many is refused, with nothing reserved, and exactly what is left is reserved. The refusal keeps SCRUM-134's message, with what would be left and what is needed at that moment, naming the earliest-submitted request running then.

**Change log**

* 2026-11-01: created in Sprint 4 from the SCRUM-7 epic check, after a code review of SCRUM-134.
