# Scrum records

What each sprint committed to and delivered, how the team estimates, and the
Definition of Done it works to.

| Document | What it holds |
|---|---|
| [sprint-1.md](sprint-1.md) | Sprint 1 (9–23 Sep 2026): goal, dates, points committed and done, every story and its outcome, scope changes, review and retrospective |
| [sprint-2.md](sprint-2.md) | Sprint 2 (23 Sep – 7 Oct 2026), the same |
| [sprint-3.md](sprint-3.md) | Sprint 3 (7–21 Oct 2026), the same, and its commitment against velocity |
| [estimation.md](estimation.md) | The point scale with an example story for each value, velocity per sprint, every re-estimate, and Sprint 3's commitment against velocity |
| [definition-of-done.md](definition-of-done.md) | The Definition of Done, each item pointing to where it is written and what enforces it |

## Where the figures come from

Every figure names its source.

- **Jira**, read on 23 Oct 2026:
  - each sprint's goal and dates, from the board;
  - each item's type, points, priority, labels and status;
  - each item's change history, for when it entered or left a sprint and
    when it reached or left Done;
  - the **Change log** at the end of each story's description, for
    re-estimates.
- **git**: pull requests merged into `main` between a sprint's start and close
  (`gh pr list --state merged --base main`).

Some terms used across these records:

- **Committed at start:** in the sprint when Jira started it.
- **Added during:** joined the sprint after it started.
- **Done by close:** Done when the sprint was closed, and not reopened before
  then.
- **Points:** the estimate in Jira today. A sprint record says where an
  estimate changed during the sprint.

Times are Singapore time (SGT).

Sections only the team can write, such as the sprint review and the
retrospective, say **_To be completed by the team._** rather than being
filled in from guesswork.

Sprint 4 is in progress. Its record is to be written at its close, the same
way.
