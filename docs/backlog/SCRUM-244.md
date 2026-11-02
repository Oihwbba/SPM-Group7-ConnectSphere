<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-11-02. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-244 - Chore: Re-sync docs/backlog for the SCRUM-7 to SCRUM-10 stories whose Customer basis was edited on 29 Oct

| | |
|---|---|
| **Type** | Task |
| **Epic** | - |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-244 |

---

On 29 Oct the Customer basis line of ten stories in the Venue Management (SCRUM-7), Event Change & Notifications (SCRUM-8), Access Control (SCRUM-9) and Equipment Management (SCRUM-10) epics was edited in Jira: SCRUM-32, 36, 45, 48, 50, 53, 121, 124, 134 and 142. docs/backlog still shows the old text, so the snapshot that reviewers and the GLM reviewer check PRs against disagrees with Jira. SCRUM-124's new line also had a stray full stop ("Briefing section 6. examples:"), fixed in Jira here.

Only those ten files are re-synced here. Out of scope, because another PR already carries them: SCRUM-141 (re-synced in #319, which already changes its file), SCRUM-241 (added by its own PR, #317) and SCRUM-216's status (its epic check, #311). SCRUM-217 was checked and differs only in its sync date. The full re-sync stays with SCRUM-235, so the index's last-synced date is unchanged.

**Acceptance criteria**

1. docs/backlog/SCRUM-32, 36, 45, 48, 50, 53, 121, 124, 134 and 142 are regenerated from Jira, untouched by hand, and each matches its Jira description.
2. Every other child of SCRUM-7 to SCRUM-10 is checked against Jira, and any difference is either re-synced here or named as left to another PR.
3. The PR is docs-only and changes no other file.
4. SCRUM-124's Customer basis reads "Briefing section 6 examples:", in Jira and in docs/backlog.
5. Each of those ten stories has a change-log line for its 29 Oct Customer basis edit (SCRUM-36 already had one), in Jira and in docs/backlog.

**Change log**

* 2026-10-29: created.
* 2026-10-29: AC4 added: the stray full stop in SCRUM-124's Customer basis is fixed in Jira and re-synced.
* 2026-10-31 (PR #320): SCRUM-36 added to the description and AC1. Its Customer basis quote was removed in Jira later on 29 Oct, after this chore was written, and #320 already re-syncs it, so this catches the text up with the PR. No change in scope.
* 2026-11-01 (PR #320): AC5 added at the PO's request, because the 29 Oct edits had no change-log line on nine of the stories.
