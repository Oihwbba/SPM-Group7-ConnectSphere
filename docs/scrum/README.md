# Scrum records

What each sprint committed to and delivered, how the team estimates, and the
Definition of Done it works to.

| Document | What it holds |
|---|---|
| [sprint-1.md](sprint-1.md) | Sprint 1 (9–23 Sep 2026): goal, dates, points committed and done, every story and its outcome, scope changes, review and retrospective |
| [sprint-2.md](sprint-2.md) | Sprint 2 (23 Sep – 7 Oct 2026), the same |
| [sprint-3.md](sprint-3.md) | Sprint 3 (7–21 Oct 2026), the same, and its commitment against velocity |
| [sprint-4.md](sprint-4.md) | Sprint 4 (21 Oct – 4 Nov 2026), the same, with its planning poker, epic checks and recordings |
| [estimation.md](estimation.md) | The point scale with a reference story for each value, how estimates are reached, velocity per sprint, every re-estimate, and Sprint 3's commitment against velocity |
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
- **The team's Scrum and Sprint Documentation** (submission folder 4, with
  the Across-Sprint Burndown sheet and Jira's sprint burndown reports): the
  sprint planning, review and retrospective minutes, and the recordings.
  Where a figure here and that document differ, the difference is explained
  where it appears.

Story and task names are Jira's current titles, read on 6 Nov 2026. Jira's
titles were reworded during the project, so older minutes and recordings may
use an earlier name for the same key; the key is what identifies the item.

Some terms used across these records:

- **Committed at start:** in the sprint when Jira started it.
- **Added during:** joined the sprint after it started.
- **Done by close:** Done when the sprint was closed, and not reopened before
  then.
- **Points:** the estimate in Jira today. A sprint record says where an
  estimate changed during the sprint.
- **Reopened and closed again:** the item went back from Done in Jira, for
  example for a gap found in review or an audit, and was moved to Done again
  once fixed. The reason is in the item's Jira comments; [Sprint 3](sprint-3.md)
  lists the gaps behind its 20 Oct reopens and the pull requests that fixed
  them.

Times are Singapore time (SGT).

Sections only the team can write, such as the sprint review and the
retrospective, are taken from the team's own minutes rather than filled in
from guesswork.

All four sprints are finished. Sprint 4, the last, closed on 4 Nov 2026.

| Sprint | Dates | Product Owner | Scrum Master | Stories | Points done |
|---|---|---|---|---|---|
| [1](sprint-1.md) | 9–23 Sep | Jin Hong | Felicia | 16 | 37 (31 counted at the review) |
| [2](sprint-2.md) | 23 Sep – 7 Oct | Felicia | Jun Bin | 25 | 56 |
| [3](sprint-3.md) | 7–21 Oct | Caylern | Hann Qian | 34 | 126 |
| [4](sprint-4.md) | 21 Oct – 4 Nov | Hann Qian | Jun Bin | 9 | 15 |
| Total | | | | 84 | 234 (228 counted) |
