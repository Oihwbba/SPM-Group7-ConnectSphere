<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-29. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-239 - Chore: Fix what the SCRUM-11 epic check found in the docs and Jira notes

| | |
|---|---|
| **Type** | Task |
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | In Review |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-239 |

---

Found during the SCRUM-218 epic check (AC2, AC3, AC4). SCRUM-242 was merged into this chore on 29 Oct, so one PR carries every fix.

**Done stories that don't record what later stories changed.** Later stories changed what SCRUM-72 to 77 say, but the old stories don't record it, so a reader of SCRUM-72, 73 or 76 sees criteria that no longer describe the code:

* SCRUM-162 AC7 supersedes SCRUM-72 AC2 (one venue), and says so in its Supersedes line, but SCRUM-72 has no note. It also supersedes SCRUM-76 AC1's one venue (TC-76-01 says so), which neither story records.
* SCRUM-171 AC4 narrows SCRUM-72 AC1 and AC8 and SCRUM-73 AC6 (an event whose Registration needed is No isn't listed, opened or opened for registration). SCRUM-171 has no Supersedes line and SCRUM-73 doesn't mention it.
* SCRUM-85 AC8 and AC9 (from SCRUM-133) extend SCRUM-76 AC2's statuses and let a registered Attendee open an event being re-planned, an exception to SCRUM-72 AC7 and AC8. Only Boundary and Related notes say so, and SCRUM-85 has no Supersedes line.
* SCRUM-75's 8 Oct refinement removed setting the registration window, but SCRUM-73 AC6 and its Business rule, and docs/testing/SCRUM-73.md, still say the window is set in SCRUM-75.
* SCRUM-76 and SCRUM-77 carry Related notes that are no longer true (the SCRUM-42 page name, fixed by SCRUM-146; AC3, AC4 and AC6 "remain", though the story is Done).
* docs/testing TC-75-14 is retired for SCRUM-128 AC11 but doesn't cite the case that replaced it (TC-128-16), as SCRUM-203 AC1 asks.
* docs/testing TC-72-06, TC-72-07, TC-73-05 and TC-76-01 test the superseded criteria without saying what changed them or which case tests the change. Their automated tests are still correct (they test an Attendee who isn't registered, a seeded window, and so on), so only the test cases are out of date.

Done stories are not reopened: only notes, Supersedes lines and change logs are edited, never a Done story's user story, criteria or title.

**Docs that disagree with Jira** (from SCRUM-242):

* The Release 1 feature table in docs/product-context.md lists SCRUM-70 as a main story of feature #18 Attendee registration (SCRUM-11), but in Jira SCRUM-70 belongs to SCRUM-9 Access Control.
* SCRUM-212 belongs to SCRUM-11 Attendee Registration in Jira, but the feature table doesn't list it under feature #18, and docs/backlog (synced 21 Oct, before it was linked) still files it under "Stories with no epic".
* SCRUM-80 and SCRUM-115 didn't say why they are beyond Release 1, and SCRUM-115's 1 Oct change log still said SCRUM-79 is in Release 1. Both were fixed in Jira on 29 Oct; docs/backlog still shows the old text.

Decision (29 Oct, Felicia): SCRUM-70 stays in SCRUM-9, because its point is who may see an event's registrations, which is authorisation. SCRUM-212 stays in SCRUM-11. Jira is right in both cases, so the documents are fixed to match it.

Out of scope: SCRUM-212 AC1 lists four registration states, while SCRUM-75 AC7 and the merged code (#310) also show "Not open yet" with the opening time. That is raised with the story's owner (Caylern) and the PO (Hann Qian) separately. docs/data-model.md's story-to-table map keeps SCRUM-70 against the Registration table, because that map is about which stories use a table, not which epic they belong to.

**Acceptance criteria**

1. SCRUM-72, SCRUM-73 and SCRUM-76 each carry a "Superseded in part" note naming the criterion and the story that changed it; their criteria and titles are unchanged.
2. SCRUM-171 and SCRUM-85 carry a Supersedes line for the criteria they changed, and SCRUM-162's names SCRUM-76 AC1.
3. The out-of-date Related sentences in SCRUM-76 and SCRUM-77 are removed.
4. Every edit has a dated change-log line, and the Product Owner (Hann Qian) approves the wording.
5. docs/testing/SCRUM-75.md TC-75-14 cites TC-128-16, docs/testing/SCRUM-73.md no longer says the window is set in SCRUM-75, the test cases of the superseded criteria (TC-72-06, TC-72-07, TC-73-05 and TC-76-01) say what changed and cite the case that tests it now, and docs/backlog is re-synced from Jira for every item changed; the PR is docs-only.
6. In docs/product-context.md's Release 1 feature table, SCRUM-70 is listed under feature #1 (SCRUM-9 Access Control) and no longer under feature #18 (SCRUM-11 Attendee Registration).
7. The same table lists SCRUM-212 under feature #18 (SCRUM-11).
8. docs/backlog/SCRUM-212.md is re-synced from Jira, and the backlog index lists SCRUM-212 under SCRUM-11 instead of "Stories with no epic".
9. Jira is unchanged: SCRUM-70's epic stays SCRUM-9 and SCRUM-212's stays SCRUM-11.
10. The PR reports the result of the attendee e2e specs run against a local database, as evidence for SCRUM-218 AC3 (feature #18 works end to end).
11. docs/backlog/SCRUM-80.md and SCRUM-115.md are re-synced from Jira, so each gives its reason for the beyond-release-1 label (SCRUM-218 AC4).

**Change log**

* 2026-10-29: SCRUM-212 AC1 taken out of scope, to be raised with Caylern and Hann Qian instead; its Jira edit was reverted.
* 2026-10-29: a second pass of the epic added SCRUM-76 AC1 (SCRUM-162), SCRUM-85's changes to SCRUM-72 and SCRUM-76, and the SCRUM-73 test-doc note.
* 2026-10-29: SCRUM-242 merged in as AC6 to AC11 (its AC1 to AC6, in the same order); renamed from "Record which later stories supersede the Attendee Registration stories (SCRUM-72 to 77)". AC1 to AC5 are unchanged.
* 2026-10-29: AC5 extended to the test cases of the superseded criteria (TC-72-06, TC-72-07, TC-73-05, TC-76-01), found when checking that the superseded stories' tests still test the right thing. Their tests needed no change.
