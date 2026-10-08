<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-09. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-151 - Run CI once per pull request commit, not twice

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-151 |

---

Type: technical task. Keeps CI fast without losing any CI evidence.

## Why this exists

`.github/workflows/ci.yml` runs on `push` (every branch) and `pull_request`. On a branch with an open pull request, every commit therefore runs `build-and-test` twice: the same 14 steps, including migrations, seed, coverage and the Playwright e2e suite (about 7–10 minutes per run).

Checked on PR #105 (commit 2985438): the push run and the pull_request run executed identical steps, and the code they tested was byte-identical (same git tree), because main had not moved since the branch was cut. The same pairing shows on every recent PR (#101, #104, #105, #106).

The pull_request run is the one that matters: it tests the branch merged into the current main, it is what the merge gate shows, and the GLM reviewer and the reviewer-memory job both read it.

## Scope

1. Limit the `push` trigger to `main`, keep `pull_request` unchanged.
2. Update ADR 0005, which records the old two-run behaviour, and the header comment in ci.yml.

## Acceptance criteria

* A commit pushed to a branch with an open pull request runs `build-and-test` once (the pull_request run), not twice.
* Every push to main still runs `build-and-test`, so each merged commit keeps its own CI result.
* The required `build-and-test` check still reports on pull requests, so the merge gate is unchanged.
* ADR 0005 and the ci.yml header describe the new triggers, including that a branch with no open pull request gets no CI until one is opened.

Needs Jin Hong's approval (CODEOWNERS on .github/).
