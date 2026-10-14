<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-15. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-175 - Chore: Keep the key design diagrams and a Server Actions reference in docs/design

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-175 |

---

The design pack made on 2026-10-11 (C4, class, sequence, state, business-process and data-model diagrams) lives in a separate team design document. The repo keeps only the few diagrams worth looking up while working on the code, plus a text reference of every Server Action, so the people and AI assistants changing the code have them next to it. Found by the design-pack audit on 2026-10-11 (item A4).

**Acceptance criteria**

1. `docs/design/` holds the key diagrams as images GitHub displays: the containers and components (C4 levels 2 and 3), and the target lifecycles of an event, a venue booking and a safety check. The rest of the pack stays in the team's design document.
2. `docs/design/README.md` lists each diagram, says whether it shows what is built, the Release 1 target or both, and when it was last checked against the code. CLAUDE.md points to it.
3. Every diagram marked built matches `main`, and every target diagram matches the Jira stories it cites. A mismatch is fixed or noted next to the diagram.
4. An API reference lists every Server Action on `main` with its permission, its input schema, the tables it writes and the rows it locks.
5. The diagram files contain no scripts or links to outside resources, and a test enforces it.

**Change log**

* 2026-10-12: narrowed from the whole pack to the key diagrams, because the full pack is kept in a separate design document (Jin Hong). AC5 adds the test the GLM review asked for on #167.

Found by the design-pack audit on 2026-10-11.
