<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-11. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-173 - Chore: Bring the docs up to date with the code and the Week 7 changes

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-173 |

---

The project docs had drifted from the code and from the Week 7 customer changes (received 2 Oct, SCRUM-158). An audit of every Markdown file outside `docs/backlog/` on 2026-10-11 found 58 issues across the README, CONTRIBUTING, CLAUDE.md, the data model, the product context, the AI reviewer's docs, the ADRs and the test specs.

**Acceptance criteria**

1. No doc tells a reader to run a command that could touch the shared database without saying it must be local: `db:reset`, `db:migrate`, the integration tests, coverage and e2e all name the local URL.
2. `docs/product-context.md` reflects Week 7:

    * holds are in scope;
    * the feature table names the Week 7 stories and no longer cites SCRUM-127 or SCRUM-133;
    * the lifecycle marks each Week 7 change "not built yet";
    * the booking glossary lists every status;
    * account creation is decided (SCRUM-153, not needed).

3. Rules described as built match the code on `main`: database constraints and triggers, seed contents, the one-venue rule, the unavailability reasons, `registrationRequired` and `noEquipmentNeededAt`, and the status gates.
4. Every story key a doc cites exists in the backlog, or is marked as merged or dropped.
5. Every test spec covers every acceptance criterion of its story, or says why not.

    * Every "Automated by" title matches a real test.
    * Every quoted message is one the code still produces.
    * Every table row agrees with its section.
    * The testing index lists every spec, with the right counts.

6. ADRs follow `docs/adr/README.md`:

    * an amended ADR says so, in dated addenda;
    * each has the four sections and names its stories;
    * superseded claims (for example `vercel.json`) are marked.

7. Product questions the audit raised go to the PO rather than being decided in the docs. One example: SCRUM-50 AC7 says Planning only, but the code also accepts Approved.

Found by an audit of the docs on 2026-10-11.
