# How the team uses AI

Our module requires us to be open about AI assistance, and in the Q&A each of
us explains and justifies the code, the architecture and what AI contributed.
This page says which AI tools we use and for what, the rules they work under,
what a person always decides, and how we catch AI mistakes. It also answers
the Week 10 CFO question: what value the team added beyond AI. Who explains
each part of the system is in [ownership.md](ownership.md). (SCRUM-197)

## The tools, and what each is for

| Tool | What we use it for | Where it is set up |
|---|---|---|
| **Claude Code** (Anthropic's coding assistant; each commit's trailer names the model, e.g. Claude Opus 5.5) | Drafting code, tests, test-case documents and Jira text from the story and the team's decisions; running the checks; reading the codebase to answer questions | [`CLAUDE.md`](../CLAUDE.md), read at the start of every session |
| **GLM-5.3** (Zhipu AI), run by GitHub Actions | Reviewing every pull request against its story's acceptance criteria and the team's rules, in one comment; after each merge, proposing lessons for its own memory | [`.github/workflows/ai-review.yml`](../.github/workflows/ai-review.yml), [`.github/scripts/ai-review.mjs`](../.github/scripts/ai-review.mjs), [ADR 0008](adr/0008-advisory-ai-code-review.md) |
| **GitHub Copilot** | Reviewed pull requests for the first week, until GLM replaced it on 14 Sep (ADR 0008's first addendum). Its coding agent made one commit (`e7f5d6a0`, SCRUM-15). | No longer used |

Claude writes; GLM checks, as a second model with different blind spots; and
a person decides. Neither tool can merge, move a story to Done, or change the
rules it works under without a person approving it (next two sections).

## The rules they work under

- **[`CLAUDE.md`](../CLAUDE.md)**, the working agreement every AI session reads first:
  - every branch, commit and pull request carries its SCRUM key;
  - work is checked against the story's acceptance criteria (`docs/backlog`) and test cases (`docs/testing`), not just against the code;
  - tests are evidence: expected values come from the criteria, and each test is broken once to see it fail;
  - the shared database is never reset or migrated;
  - every AI-assisted commit keeps its `Co-Authored-By: Claude` trailer.
- **[`CONTRIBUTING.md`](../CONTRIBUTING.md)**, the pattern for building a feature and the checklist before a pull request. Human reviewers and GLM use the same list.
- **[`.github/ai-review/instructions.md`](../.github/ai-review/instructions.md)**, what GLM checks: security and authorisation, each acceptance criterion against the diff, correctness and concurrency, data and migrations, the team's conventions, the tests, and the UI's states.
- **[`.github/ai-review/memory.md`](../.github/ai-review/memory.md)**, lessons from past reviews. There are 28, each dated and citing the pull request it came from.
- **GLM reads these files from the pull request's base branch**, so a pull request can't change the rules it is reviewed by (ADR 0008).

## What a person always decides or checks

| Decision | Who | How it is enforced |
|---|---|---|
| What to build: stories and their acceptance criteria | The team, from the customer's briefing and Q&A; the Product Owner approves each change | Jira's change log on each story ("PO Approved") |
| Whether a story is Done | The sprint's Product Owner | Done needs the merge, CI green **and** the PO's acceptance (CLAUDE.md, "Board discipline") |
| Whether a pull request merges | Its author, only once `build-and-test` and the GLM review are green, after reading the review | `build-and-test` is a required check on `main`. The GLM review is required by the team's rule (CLAUDE.md), not by branch protection: it was taken off the required checks on 16 Oct while GLM's quota ran out, and hasn't been put back. |
| Changes to the checks themselves (`.github/`, `package.json`, the test configs) | A teammate other than the author | [`CODEOWNERS`](../.github/CODEOWNERS): AI can't switch off its own checks |
| What the reviewer learns | A person, before it reaches `main` | `ai-memory.mjs` only opens a pull request; 13 have been merged so far |
| Anything run against the shared database | A person, explicitly | CLAUDE.md fact 5: only `db:deploy` and `db:seed` there; reset and migrate only a local one |
| Questions the customer answers, and the demo | The team | The customer Q&A register and Week 4 instructions (course Google Drive) |

## The figures, from git

Taken from `main` at `757c69d3` (29 Oct 2026). Re-run each command to update
it.

| Figure | Value | Command |
|---|---|---|
| Commits on `main`, excluding merges | 632 | `git rev-list --no-merges --count main` |
| …of which carry a `Co-Authored-By: Claude` trailer | **583 (92%)** | `git log main --no-merges --format='%(trailers:key=Co-Authored-By,valueonly,separator=%x2C)' \| grep -c Claude` |
| Commits authored as Claude | **34** (25 commits and 9 merges) | `git log main --format=%ae \| grep -c noreply@anthropic.com` |
| Commits by GitHub's Copilot coding agent | 1 | `git log main --format=%h --author=Copilot` |

Commits per person, excluding merges, with how many carry the Claude trailer:

| Person | Git identities | Commits | With the trailer |
|---|---|---|---|
| Jin Hong | `oihwbba@gmail.com` | 308 | 293 |
| Felicia Or | `felicia.or.2024@smu.edu.sg` (as "Felicia" and "feliciaor2024-arch") | 108 | 92 |
| Jun Bin | `yiamjunbin@gmail.com` and his GitHub no-reply address | 106 | 104 |
| Hann Qian | `hq.liew.2024@computing.smu.edu.sg` | 46 | 46 |
| Caylern Goh | `caylern.goh.2024@computing.smu.edu.sg`, and `caynft@gmail.com` (named "Oihwbba" or "Cay" in git) | 25 | 23 |

Command: `git log main --no-merges --format='%ae%x09%(trailers:key=Co-Authored-By,valueonly,separator=%x2C)'`, counted per address.

**Commit counts are not a measure of who did the work.** Before 4 Oct, pull
requests were squash-merged: a squash turns a pull request's commits into one,
credited to its author, with a co-author line for everyone who merged `main`
into the branch. Four pull requests (#52, #53, #54
and #57) re-landed teammates' work under Jin Hong's name so that it would
deploy, before ADR 0009 fixed the deploys. Who explains what is in
[ownership.md](ownership.md).

## How AI output gets corrected

The examples below are cases where a person or the second model found a fault
in AI-assisted work. Each links its evidence.

- **The reviewer's own mistakes become lessons.** When GLM reports something the team chose on purpose, or misses a fact, the lesson goes in its memory. A person approves it first, and 13 such pull requests have merged. Each lesson states why something is deliberate, and must never hide a real defect ([memory.md](../.github/ai-review/memory.md), "Rules for a lesson").
- **GLM finds faults in Claude's work.** On #313, GLM found 22 test titles that Claude's rename had left with a doubled prefix, 7 tags with a stray comma, and one with a stray slash. All of them were fixed on the pull request ([#313](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/313)).
- **People find what both models missed:**
  - **Race conditions.** The SCRUM-10 epic code review found two that the tests hadn't covered: SCRUM-226, where two Technical Support staff could reserve the same line, and SCRUM-227, where two simultaneous updates could both be saved. Each was fixed with a test that fails without the fix ([SCRUM-217's review](https://smu-spm-group7.atlassian.net/browse/SCRUM-217), [#293](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/293), [#292](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/292)).
  - **Stale citations.** Felicia checked every test-case citation against the test titles and found citations naming tests that no longer existed ([#302 comment](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/302#issuecomment-6444468402)). They were fixed there, and SCRUM-196 ([#318](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/318)) adds a CI check that fails on any such citation.

## Value the team added beyond AI

The Week 10 CFO update asks: *"If AI can generate so much of the code, what
value are our software development teams adding beyond simply asking AI to
build the system?"* For Release 1 of the Event Planning and Venue Booking
System, our answer is that AI turns a decision into code quickly, while the
decisions themselves came from the team. That covers what the customer needs,
which stories conflict, what each choice gives up, and whether the result is
right.

### 1. Understanding the customer: what Release 1 leaves out

- **What AI could produce alone:** every feature the briefing mentions, including an equipment catalogue with maintenance workflows.
- **What the team added:** we read the Week 4 list of features not required for Release 1, and the customer's answer in our 13 Sep Q&A register: "Technical Support Staff maintain equipment status. Maintenance workflow is not core at the moment." So we moved the catalogue to *beyond Release 1* (SCRUM-119) and seeded equipment and its unavailability instead. The availability checks (SCRUM-29, SCRUM-30) still count the seeded unavailability.
- **Evidence:** [SCRUM-119](https://smu-spm-group7.atlassian.net/browse/SCRUM-119), its description and its change log for 1 Oct.

### 2. A conflict between two finished stories (SCRUM-188)

- **What AI could produce alone:** each story exactly as written, with every test passing.
- **What went wrong:** SCRUM-38's venue search checked the event's exact period, while SCRUM-50 rounded the request out to the half hour. A venue that search showed as free could be refused once requested, and a booking held the venue for up to 29 minutes nobody needed.
- **What the team added:** we found the disagreement while building SCRUM-38 and wrote SCRUM-188 to replace SCRUM-50's rounding. The PO approved it on 21 Oct.
- **Evidence:** [SCRUM-188](https://smu-spm-group7.atlassian.net/browse/SCRUM-188), [#301](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/301).

### 3. Decisions and trade-offs: an event takes place within one day (SCRUM-190)

- **What AI could produce alone:** the form SCRUM-13 asked for, with separate start and end dates.
- **What the team added:** we traced how four rules combine:
  - every venue has opening hours;
  - a booking must fall within one day's hours;
  - a booking must cover the event's whole period;
  - confirming an event needs an approved booking.

  Together they mean a multi-day event could be submitted but never confirmed. The customer's own worked example is within one day, so we moved the check to the request form, where the Organiser can fix it, and the PO approved it on 21 Oct.
- **A second example:** [ADR 0010](adr/0010-database-prevents-venue-double-booking.md), where the database rather than the application stops a venue being double-booked. Double-booked venues are the customer's top complaint, and two members of Venue Staff can approve at the same moment, which only the database can settle.
- **Evidence:** [SCRUM-190](https://smu-spm-group7.atlassian.net/browse/SCRUM-190), [#300](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/300).

### 4. Checking AI output

- **What AI could produce alone:** code whose own tests pass.
- **What the team added:** a review of each epic, criterion by criterion against the code. A second model reviews every pull request, with its rules and memory approved by people. Every test is broken once to prove it can fail. The race conditions in SCRUM-226 and SCRUM-227 had passed every test until that review found them.
- **Evidence:** [SCRUM-217's review](https://smu-spm-group7.atlassian.net/browse/SCRUM-217), [#293](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/293), [#292](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/292), and [ADR 0008](adr/0008-advisory-ai-code-review.md), whose 18 addenda record how the team tuned the reviewer.

### 5. Testing as a user (SCRUM-186)

- **What AI could produce alone:** SCRUM-27 and SCRUM-156 exactly as accepted, which allowed a second equipment request for an event.
- **What the team added:** Felicia found in testing, on 16 Oct, that a second request made by mistake doubled what the readiness checklist required. The PO then decided an event keeps one active request, whose lines change as needs change.
- **Evidence:** [SCRUM-186](https://smu-spm-group7.atlassian.net/browse/SCRUM-186), [#267](https://github.com/Oihwbba/SPM-Group7-ConnectSphere/pull/267).

### 6. How the team delivered

- **What AI could produce alone:** code on request. It doesn't plan, prioritise or answer for the result.
- **What the team added:**
  - a rotating Product Owner who accepts each story;
  - a Definition of Done enforced by CI and that acceptance;
  - sprint records that compare each commitment with what was delivered. Sprint 3 committed 124 points against velocities of 37 and 56. That is recorded, and why we committed so much is for the team's retrospective to answer.
- **Evidence:** [`docs/scrum/`](scrum/README.md), [the Definition of Done](scrum/definition-of-done.md), [Sprint 3's commitment against velocity](scrum/sprint-3.md#commitment-against-velocity).

### For the slide deck and the demo

The deck (SCRUM-219) takes this section, and at least one example is shown
in the deck or the demo (SCRUM-198). **_To be completed by the team:_** which
example is shown, and where.
