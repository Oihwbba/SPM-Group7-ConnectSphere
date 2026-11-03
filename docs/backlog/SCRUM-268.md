<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-03. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-268 - Chore: Fix the docs that no longer match the code: product context, ADR index and Server Actions reference

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | 0 |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-268 |

---

A review on 3 Nov of every Markdown doc against the code, the schema, the CI config and Jira found docs that say something the code no longer does:

* `docs/product-context.md` says the Week 7 setup/turnaround and unavailability rules are "in the database already, in the screens not yet". SCRUM-159, 160 and 161 are Done, and their screens are on `main` (`time-clash-flags.tsx`, `record-unavailability-form.tsx`, `affected-bookings.tsx`). Its Planning row still opens with "The Coordinator books one venue", which SCRUM-162 replaced.
* `docs/adr/README.md`, ADR 0022's row, says the session pooler "allows 15 in all". ADR 0022's addendum and `lib/db.ts` say 43 (SCRUM-240).
* `docs/adr/README.md`, ADR 0008's row, doesn't say that the addenda replace the original "advisory, never a gate" decision and its `.opencodereview/rule.json`, which no longer exists.
* `docs/design/` says it lists every Server Action but leaves out `getEventEquipment` (`events/readiness-actions.ts`) and `getEventFlags` (`events/reconsideration-actions.ts`).

**Acceptance criteria**

1. `docs/product-context.md` describes the setup/turnaround clash flags and recording unavailability over existing bookings as built, and the Planning row states the several-venue rule as current.
2. ADR 0022's row in `docs/adr/README.md` gives the pooler's current limit of 43, and ADR 0008's row says its addenda replace the original advisory decision. The ADR bodies are not rewritten.
3. `docs/design/` lists every exported Server Action, including `getEventEquipment` and `getEventFlags`, matching the code.
4. Only Markdown changes.

**Out of scope:** the full `docs/backlog/` re-sync (SCRUM-235), and the SCRUM-217 Jira status that `docs/ai-usage.md` contradicts, which is a decision for the team.
