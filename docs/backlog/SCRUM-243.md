<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-29. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-243 - Chore: Fix what the SCRUM-6 epic check found in the docs and Jira notes

| | |
|---|---|
| **Type** | Task |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-243 |

---

Found during the SCRUM-213 epic check (AC2, AC3). Later stories changed what Done SCRUM-6 stories say, but only SCRUM-20 records it, so a reader of SCRUM-13, 14, 17, 19, 81, 84, 108, 110 or 117 sees criteria that no longer describe the code. Some notes and docs are also no longer true.

**Done stories that don't record what later stories changed**

* SCRUM-13: AC1, AC4 and AC6 (event timezone) by SCRUM-129 AC1; AC1 and AC8 (date and times) by SCRUM-190; AC1 and AC4's free-text registration needs by SCRUM-171 AC1 and AC2. SCRUM-129 and SCRUM-171 have no Supersedes line for it.
* SCRUM-14 AC1 (automatic assignment) by SCRUM-165 AC1.
* SCRUM-17 AC2 (who can view) by SCRUM-141 (Coordinators, Venue Staff, Technical Support, read-only), SCRUM-165 (Leads) and SCRUM-166 (Safety Officers). SCRUM-141 says so only in its "Why".
* SCRUM-19 AC1 (rests in Approved) by SCRUM-81 AC1 and SCRUM-135 AC12; AC4 (resubmit) by SCRUM-126; deciding an unassigned request by SCRUM-165 and SCRUM-135. SCRUM-126 has no Supersedes line.
* SCRUM-24's transition table by SCRUM-135, and its Submitted to Under Review owner by SCRUM-165. SCRUM-135's Supersedes line doesn't name SCRUM-24.
* SCRUM-81 AC2 by SCRUM-165 and SCRUM-135; AC3 and AC4 by SCRUM-166; AC6 by SCRUM-162.
* SCRUM-84's "Submitted" tab and status names by SCRUM-131 AC1, which has no Supersedes line.
* SCRUM-108 AC11 by SCRUM-165 AC9 and SCRUM-135 AC4 and AC6.
* SCRUM-110 AC1 and AC2 by SCRUM-162, AC2 by SCRUM-163, AC3 by SCRUM-170, AC5 by SCRUM-166.
* SCRUM-117 AC3 by SCRUM-162 and SCRUM-163.
* SCRUM-165 AC2 (queue columns) by SCRUM-211 AC1, once SCRUM-211 is delivered.

**Notes and docs that are no longer true**

* SCRUM-18 cites SCRUM-109 (merged into SCRUM-108) and SCRUM-56 (dropped; the notification is SCRUM-45 AC8).
* SCRUM-81's Related note says SCRUM-81 and SCRUM-110 "must merge together"; SCRUM-108's describes the Sprint 1 code; SCRUM-16's dependency note says no story builds the request list (SCRUM-84 does); SCRUM-110's extension list says "Not requested yet" (SCRUM-170 AC4: Not decided); SCRUM-71 says "the SCRUM-81 branch adds".
* docs/testing: SCRUM-81's "Ready" leaves out the safety check and No equipment needed; SCRUM-13's says two criteria were overtaken and lists three; SCRUM-17's names only SCRUM-165.
* docs/product-context.md's Release 1 feature table doesn't list SCRUM-129 or SCRUM-190 under feature #2.
* docs/adr/0014's decision 6 and last Consequence still say a resubmission falls back to automatic assignment (SCRUM-20), which SCRUM-165 AC9 replaced with the Lead's queue.

Decision (29 Oct, Felicia): SCRUM-211 AC1 supersedes SCRUM-165 AC2; SCRUM-171 AC1 supersedes SCRUM-13's registration needs; SCRUM-141 stays listed under feature #5 Coordinator assignment.

Done stories are not reopened: only notes, Supersedes lines and change logs are edited, never a user story, criterion or title.

**Acceptance criteria**

1. SCRUM-13, 14, 17, 19, 81, 84, 108, 110, 117 and 165 each carry a "Superseded in part" note naming the criterion and the story that changed it, and SCRUM-24's ownership note names SCRUM-165; their criteria and titles are unchanged.
2. SCRUM-126, 129, 131, 141, 171 and 211 carry a Supersedes line for the criteria they changed, and SCRUM-135's names SCRUM-24's transition list.
3. The out-of-date notes in SCRUM-16, 18, 71, 81, 108 and 110 are corrected.
4. Every edit has a dated change-log line, and the Product Owner (Hann Qian) approves the wording.
5. docs/testing for SCRUM-13, 17 and 81 matches the superseding stories, the feature table lists SCRUM-129 and SCRUM-190 under feature #2, ADR 0014 has a dated addendum for SCRUM-165, and docs/backlog is re-synced from Jira for every item changed; the PR is docs-only.

**Change log**

* 2026-10-29: created from the SCRUM-213 epic check.
* 2026-10-29: ADR 0014 added to the docs found out of date, and to AC5.
