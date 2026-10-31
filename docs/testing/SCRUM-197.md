# SCRUM-197 — Document how the team uses AI and who owns each part of the system: test cases

Story and acceptance criteria: [docs/backlog/SCRUM-197.md](../backlog/SCRUM-197.md).
Format and conventions: [README.md](README.md).

SCRUM-197 is a Chore task whose deliverables are two documents,
[`docs/ai-usage.md`](../ai-usage.md) and [`docs/ownership.md`](../ownership.md).
Its cases are checks a reviewer runs by reading them and re-running the
commands they quote; no test automates them.

**Shared pre-conditions:** this branch checked out, with `main` fetched.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-197-01](#tc-197-01) | Positive | AC 1 | Manual (a document check) |
| [TC-197-02](#tc-197-02) | Positive | AC 2 | Manual (re-running the commands) |
| [TC-197-03](#tc-197-03) | Positive | AC 3 | Manual (each teammate confirms their rows) |
| [TC-197-04](#tc-197-04) | Positive | AC 4 | Manual (a document check) |
| [TC-197-05](#tc-197-05) | Positive | AC 5, AC 6 | Manual (a document check) |
| [TC-197-06](#tc-197-06) | Negative | AC 6 | Manual (opening every link) |
| [TC-197-07](#tc-197-07) | Positive | AC 7 | Manual (the deck and the demo) |

---

### TC-197-01

| Item | Content |
|---|---|
| Test Case ID | TC-197-01 |
| Test Scenario | [Positive] AC 1: the tools, their rules, what a person decides, and corrected AI output are all stated |
| Pre-conditions | Shared. |
| Test Steps | 1. Read `docs/ai-usage.md`. |
| Test Data | `docs/ai-usage.md`; `CLAUDE.md`; `.github/ai-review/instructions.md`; `.github/ai-review/memory.md`; `main`'s branch protection |
| Expected Result | It names Claude Code, GLM-5.3 and Copilot, and what each is used for, and every teammate has confirmed no other tool is missing. It states the rules each works under (CLAUDE.md, CONTRIBUTING.md, the reviewer's instructions and memory, ADR 0008) as those files state them. It states what a person decides, with what enforces it, including where enforcement has a gap (the GLM review isn't a required check; admins bypass branch protection). It gives examples of mistakes in AI-assisted work being caught, each linked. |

**Automated by:** Manual (a document check, in review).

### TC-197-02

| Item | Content |
|---|---|
| Test Case ID | TC-197-02 |
| Test Scenario | [Positive] AC 2: every figure comes from git, with the command that produced it |
| Pre-conditions | Shared, at the commit the document names (`757c69d3`). |
| Test Steps | 1. Run each command in "The figures, from git", as written. <br> 2. Run the trailer count again with `main` in place of the commit. |
| Test Data | Commit `757c69d3`; the four commands in the table |
| Expected Result | 1: each command prints the figure given: 632, 583, 34 and 1. 2: the count on a later `main` is at least 583; the percentage can change either way. |

**Automated by:** Manual (re-running the commands, in review).

### TC-197-03

| Item | Content |
|---|---|
| Test Case ID | TC-197-03 |
| Test Scenario | [Positive] AC 3: each epic, area of the code and ADR names who explains it, and the team confirms every row |
| Pre-conditions | Shared. |
| Test Steps | 1. Read `docs/ownership.md`. <br> 2. List the folders and files under `app/`, `lib/`, `components/`, `prisma/`, `tests/`, `e2e/` and `.github/`, and find each in a row. <br> 3. Each teammate confirms or corrects every row naming them, and the team settles each "Team to choose". |
| Test Data | `docs/testing/README.md` (story owners); `docs/backlog/README.md` (each epic's stories); `docs/adr/` (21 ADRs) |
| Expected Result | 1: all six epics and all 21 ADRs have a row with its evidence. 2: every path falls under some row. 3: every row names one person, or says whose stories it follows, and is marked ✅. |

**Automated by:** Manual (each teammate confirms their rows).

### TC-197-04

| Item | Content |
|---|---|
| Test Case ID | TC-197-04 |
| Test Scenario | [Positive] AC 4: the README points to both documents |
| Pre-conditions | Shared. |
| Test Steps | 1. Read `README.md`, "Start here" and "Project layout". |
| Test Data | `README.md` |
| Expected Result | Both sections link or list `docs/ai-usage.md` and `docs/ownership.md`. |

**Automated by:** Manual (a document check, in review).

### TC-197-05

| Item | Content |
|---|---|
| Test Case ID | TC-197-05 |
| Test Scenario | [Positive] AC 5, AC 6: "Value the team added beyond AI" answers the CFO's question, with examples beyond producing code |
| Pre-conditions | Shared. |
| Test Steps | 1. Read the section in `docs/ai-usage.md`. |
| Test Data | The Week 10 CFO update. |
| Expected Result | It quotes the question, for Release 1 of the Event Planning and Venue Booking System. The team has agreed the answer and chosen its examples. Each example says what AI could produce alone, what the team added, and its evidence. Between them they cover understanding the customer, a conflict between stories (SCRUM-188), decisions and trade-offs, checking AI output, and how the team delivered. |

**Automated by:** Manual (a document check, in review).

### TC-197-06

| Item | Content |
|---|---|
| Test Case ID | TC-197-06 |
| Test Scenario | [Negative] AC 6: no example rests on a claim its evidence doesn't support |
| Pre-conditions | Shared; signed in to Jira. |
| Test Steps | 1. Open every link in "How mistakes in AI-assisted work get caught" and "Value the team added beyond AI". <br> 2. For each pull request named, check whether it is merged or open. |
| Test Data | The linked Jira stories, pull requests and comment |
| Expected Result | 1: every link opens, and each says what the example claims: the dates, the PO's approval, who found the problem, whether an AI tool was used, and how it was fixed. 2: no open pull request is described as if its work had landed. |

**Automated by:** Manual (opening every link, in review).

### TC-197-07

| Item | Content |
|---|---|
| Test Case ID | TC-197-07 |
| Test Scenario | [Positive] AC 7: at least one example is shown in the deck or the demo, and the section is handed to SCRUM-219 |
| Pre-conditions | The slide deck (SCRUM-219) is drafted. The demo script (SCRUM-198) is Done and has none of the examples. |
| Test Steps | 1. Find the example in the deck or the demo. <br> 2. Check the deck's "value beyond AI" slide takes its content from this section. |
| Test Data | The slide deck; `docs/demo.md` |
| Expected Result | At least one example is shown, and the document says which one and where. |

**Automated by:** Manual (the deck and the demo; to be completed by the team).
