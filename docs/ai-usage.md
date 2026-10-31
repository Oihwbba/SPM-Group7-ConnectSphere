# How the team uses AI

Our module requires us to be open about AI assistance, and in the Q&A each of
us explains and justifies the code, the architecture and what AI contributed.
This page says which AI tools we use and for what, the rules they work under,
what a person decides, and how mistakes in AI-assisted work get caught. It
also proposes an answer to the Week 10 CFO question: what value the team added
beyond AI. Who explains each part of the system is in
[ownership.md](ownership.md). (SCRUM-197)

## The tools, and what each is for

| Tool | What we use it for | Where it is set up |
|---|---|---|
| **Claude Code** (Anthropic's coding assistant; most commit trailers name the model, e.g. Claude Opus 5.5) | Drafting code, tests, test-case documents, pull request descriptions and comments, and Jira text, from the story and the team's decisions; running the checks; reading the codebase to answer questions. 264 of the 331 pull requests carry its "Generated with Claude Code" line. | [`CLAUDE.md`](../CLAUDE.md), read at the start of every session |
| **GLM-5.3** (Zhipu AI), run by GitHub Actions | Reviewing each pull request that changes code against its story's acceptance criteria and the team's rules, in one comment; after each merge, proposing lessons for its own memory. Drafts, and pull requests that change only Markdown, lockfiles or `docs/backlog`, aren't reviewed. | [`.github/workflows/ai-review.yml`](../.github/workflows/ai-review.yml), [`.github/scripts/ai-review.mjs`](../.github/scripts/ai-review.mjs), [ADR 0008](adr/0008-advisory-ai-code-review.md) |
| **GitHub Copilot** | Reviewed pull requests from 10 to 14 Sep, until GLM replaced it (ADR 0008's first addendum). Its coding agent made one commit, on 23 Sep (`e7f5d6a0`, SCRUM-15). | No longer used |

**_To be completed by the team:_** each of us confirms this is every AI tool
we used, or adds the one that's missing.

Neither tool acts on its own. Claude Code runs only the commands its user
approves, under that user's own GitHub and Jira accounts. GLM can only post a
comment and set its check. What each person still decides is listed below.

## The rules they work under

- **[`CLAUDE.md`](../CLAUDE.md)**, the working agreement every Claude Code session reads first:
  - every branch, commit and pull request carries its SCRUM key;
  - work is checked against the story's acceptance criteria (`docs/backlog`) and test cases (`docs/testing`), not just against the code;
  - tests are evidence: expected values come from the criteria, and the code is broken once per change to check that a test goes red;
  - an AI session never resets the shared database, and migrates it only with `db:deploy`;
  - every AI-assisted commit keeps its `Co-Authored-By: Claude` trailer.
- **[`CONTRIBUTING.md`](../CONTRIBUTING.md)**, the pattern for building a feature and the checklist before a pull request. Human reviewers and GLM use the same list.
- **[`.github/ai-review/instructions.md`](../.github/ai-review/instructions.md)**, what GLM checks: security and authorisation, each acceptance criterion against the diff, correctness and concurrency, data and migrations, the team's conventions, the tests, and the UI's states.
- **[`.github/ai-review/memory.md`](../.github/ai-review/memory.md)**, 28 dated entries, each citing the pull request it came from. 18 explain what the team chose on purpose, and 10 record known open gaps.
- **GLM reads these files from the pull request's base branch**, so a pull request can't change the rules it is reviewed by (ADR 0008).

## What a person decides or checks

| Decision | Who | How it is enforced |
|---|---|---|
| What to build: stories and their acceptance criteria | The team, from the customer's briefing and Q&A | Changes to criteria are recorded in each story's Jira change log, marked "PO approved" or "PO decision" where the Product Owner decided |
| Whether a story is Done | The sprint's Product Owner | Done needs the merge, CI green **and** the PO's acceptance (CLAUDE.md, "Board discipline") |
| Whether a pull request merges | Its author, once `build-and-test` and the GLM review are green, after reading the review | `build-and-test` is a required check on `main`. The GLM review is required by the team's rule (CLAUDE.md), not by branch protection: it was taken off the required checks on 16 Oct while GLM's quota had run out, and hasn't been put back. |
| Changes to the checks themselves (`.github/`, `package.json`, the test configs, `vercel.json`, `.gitattributes`) | A teammate other than the author | [`CODEOWNERS`](../.github/CODEOWNERS) requires their approval. Branch protection doesn't apply to repository admins. |
| What the reviewer learns | A person, before it reaches `main` | `ai-memory.mjs` only opens a pull request: 13 have merged, and #290 is open |
| Anything run against the shared database | A person, explicitly | CLAUDE.md fact 5: only `db:deploy` and `db:seed` there; reset and migrate only a local database |
| Questions the customer answers, and the demo | The team | The customer Q&A register and Week 4 instructions (course Google Drive) |

## The figures, from git

Taken from `main` at `757c69d3` (29 Oct 2026). Re-run each command to check
it, or replace the commit with `main` to update it.

| Figure | Value | Command |
|---|---|---|
| Commits, excluding merges | 632 | `git rev-list --no-merges --count 757c69d3` |
| …of which carry a `Co-Authored-By: Claude` trailer | **583 (92%)** | `git log 757c69d3 --no-merges --format='%(trailers:key=Co-Authored-By,valueonly,separator=%x2C)' \| grep -c Claude` |
| Commits authored as Claude | **34** (25 commits and 9 merges) | `git log 757c69d3 --format=%ae \| grep -c noreply@anthropic.com` |
| Commits by GitHub's Copilot coding agent | 1 | `git log 757c69d3 --format=%h --author=Copilot` |

One more squash commit (`2619514d`) credits Claude in its body rather than as
a trailer, so 584 commits credit Claude in some form. Of the 632 commits,
593 are by team members, 25 by Claude, 13 by the GitHub Actions bot (the
reviewer's memory pull requests) and 1 by Copilot.

**Commit counts don't measure who did the work.** Many pull requests were
squash-merged, most before 23 Sep and some since (for example #309). A squash
turns a pull request's commits into one, credited to one author, with
co-author lines for the branch's other commit authors. Four pull requests
re-landed teammates' work under Jin Hong's name so that it would deploy,
before ADR 0009 fixed the deploys: #52 (Caylern's #41), #53 (Jun Bin's #48),
#54 (Felicia's #50) and #57 (Hann Qian's #56). Who explains what is in
[ownership.md](ownership.md).

## How mistakes in AI-assisted work get caught

Each example below links its evidence.

- **The reviewer's memory.** When GLM reports something the team chose on purpose, a person writes the reason in its memory, so the reviewer doesn't report it again. Real defects nobody has fixed yet go under "Known open gaps" instead. Every entry is approved by a person ([memory.md](../.github/ai-review/memory.md), "Rules for a lesson").
- **GLM checking Claude's work.** On [#313](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/313), which is still open, GLM found:
  - test titles that Claude's rename had left with a doubled prefix (it named 16);
  - six tags with a stray comma;
  - one tag with a stray slash.

  The fixes on that pull request corrected 22, 7 and 1.
- **People choosing what to check.** Both checks below were run with Claude Code. What the team added was deciding to make them:
  - **Citations.** Felicia ran every test-case citation against the test titles. She found citations naming tests that had been renamed, moved to another file, or couldn't be found at all ([#302 comment](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/302#issuecomment-6444468402)). They were fixed there, and SCRUM-196 ([#318](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/318), still open) proposes a CI check that fails on any such citation.
  - **Race conditions.** The SCRUM-10 epic check reviewed each story's criteria against the code. It found two race conditions every test had passed: SCRUM-226, where two Technical Support staff could reserve the same line, and SCRUM-227, where two simultaneous updates could both be saved. Each was fixed with a test that fails without the fix ([SCRUM-217](https://smu-spm-group7.atlassian.net/browse/SCRUM-217), [#293](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/293), [#292](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/292)).

## Value the team added beyond AI

The Week 10 CFO update asks: *"If AI can generate so much of the code, what
value are our software development teams adding beyond simply asking AI to
build the system?"*

**_To be completed by the team:_** agree the answer below, and choose which
of the candidate examples go in the slide deck.

**Proposed answer**, for Release 1 of the Event Planning and Venue Booking
System: AI turns a decision into code quickly, while the decisions came from
the team. That covers what the customer needs, where stories conflict, what
each choice gives up, what to check, and whether the result is right.

### Candidate 1. Understanding the customer: what Release 1 leaves out

- **What AI could produce alone:** every feature the briefing mentions, including an equipment catalogue with maintenance workflows.
- **What the team added:** we read the Week 4 list of features not required for Release 1, and the team's 13 Sep Q&A register treats equipment and its status as seed data. SCRUM-119 records its customer basis as "Technical Support Staff maintain equipment status. Maintenance workflow is not core at the moment." So we moved the catalogue to *beyond Release 1* and seeded equipment and its unavailability instead. The availability checks (SCRUM-29, SCRUM-30) still count the seeded unavailability.
- **Evidence:** [SCRUM-119](https://smu-spm-group7.atlassian.net/browse/SCRUM-119), its description and its change log for 1 Oct.

### Candidate 2. A conflict between a finished story and one being built (SCRUM-188)

- **What AI could produce alone:** each story exactly as written, with every test passing.
- **What went wrong:** SCRUM-50, already Done, rounded a venue request out to the half hour, while SCRUM-38's search, then being built, checked the event's exact period. A venue that search showed as free could be refused once requested, and a booking held the venue for up to 29 minutes at each end that nobody needed.
- **What the team added:** we found the disagreement while building SCRUM-38 and wrote SCRUM-188 to replace SCRUM-50's rounding. The PO approved it on 21 Oct.
- **Evidence:** [SCRUM-188](https://smu-spm-group7.atlassian.net/browse/SCRUM-188), [#301](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/301).

### Candidate 3. Decisions and trade-offs: an event takes place within one day (SCRUM-190)

- **What AI could produce alone:** the form SCRUM-13 asked for, with separate start and end dates.
- **What the team added:** we traced how four rules combine:
  - every venue has opening hours;
  - a booking must fall within one day's hours;
  - a booking must cover the event's whole period;
  - confirming an event needs an approved booking.

  Together they mean a multi-day event could be submitted but never confirmed. The customer's own worked example is within one day, so we moved the check to the request form, where the Organiser can fix it. The PO approved it on 21 Oct.
- **Evidence:** [SCRUM-190](https://smu-spm-group7.atlassian.net/browse/SCRUM-190), [#300](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/300).

### Candidate 4. Choosing what to check

- **What AI could produce alone:** code whose own tests pass.
- **What the team added:**
  - deciding which checks to run: an epic check for each epic (SCRUM-213 to SCRUM-218, in progress), and Felicia's citation check;
  - a second model reviewing each code change, with rules and memory approved by people.

  The SCRUM-10 epic check found the race conditions in SCRUM-226 and SCRUM-227, which had passed every test. The checks were run with Claude Code; choosing them, and judging what they found, was the team's work.
- **Evidence:** [SCRUM-217](https://smu-spm-group7.atlassian.net/browse/SCRUM-217), [#293](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/293), [#292](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/292), [#302's comment](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/302#issuecomment-6444468402), and [ADR 0008](adr/0008-advisory-ai-code-review.md), whose 18 addenda record how the team tuned the reviewer.

### Candidate 5. Testing as a user (SCRUM-186)

- **What AI could produce alone:** SCRUM-27 and SCRUM-156 exactly as accepted, which allowed a second equipment request for an event.
- **What the team added:** Felicia found in testing, on 16 Oct, that a second request made by mistake doubled what the readiness checklist required. The PO then decided an event keeps one active request, whose lines change as needs change.
- **Evidence:** [SCRUM-186](https://smu-spm-group7.atlassian.net/browse/SCRUM-186), [#267](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/267).

### Candidate 6. How the team delivered

- **What AI could produce alone:** code on request. It doesn't plan, prioritise or answer for the result.
- **What the team added:**
  - a rotating Product Owner who accepts each story;
  - a Definition of Done enforced by CI and that acceptance;
  - sprint records comparing each sprint's commitment with what was delivered.
- **Evidence:** [`docs/scrum/`](scrum/README.md), [the Definition of Done](scrum/definition-of-done.md).

### For the slide deck and the demo

SCRUM-197 asks for at least one example to be shown in the deck or the demo.
The demo script (SCRUM-198) is already Done and doesn't include any of these,
so the deck (SCRUM-219) is where it can go. **_To be completed by the team:_**
which example is shown, and where.
