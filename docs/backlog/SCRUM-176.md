<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-12. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-176 - Chore: Write test-case documents for the 23 Done stories that have none

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | High |
| **Story points** | - |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 3 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-176 |

---

23 Done stories have no test-case document in `docs/testing`: SCRUM-13, 14, 15, 16, 17, 18, 19, 20, 23, 24, 29, 30, 65, 66, 67, 68, 69, 72, 73, 74, 76, 84 and 129. Their tests exist, but CLAUDE.md promises a test-case file for every story, and reviewers and the rubric's "Testing and traceability" row read these files. Found by the design-pack audit on 2026-10-11 (item A1).

**Acceptance criteria**

1. Each of the 23 stories has `docs/testing/SCRUM-n.md` in the format `docs/testing/README.md` sets out.
2. The cases come from the story's acceptance criteria in `docs/backlog`, not from the tests, and every criterion has at least one case.
3. Each case names the existing test that automates it, by its exact title. A criterion with no test says so plainly, as manual or still to do.
4. The testing index (`docs/testing/README.md`) lists the 23 new specs with the right counts and owners.
5. Test titles are not renamed in this task. Renaming the Sprint 1 titles to the `SCRUM-n [ACx] TC-n-xx` form touches files that open pull requests also change, so it waits until those merge.

Found by the design-pack audit on 2026-10-11.
