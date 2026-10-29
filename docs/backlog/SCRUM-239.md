<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-29. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-239 - Chore: Record which later stories supersede the Attendee Registration stories (SCRUM-72 to 77)

| | |
|---|---|
| **Type** | Task |
| **Epic** | SCRUM-11 - Attendee Registration |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-239 |

---

Found during the SCRUM-218 epic check. Later stories changed what SCRUM-72 to 77 say, but the old stories don't record it, so a reader of SCRUM-72, 73 or 76 sees criteria that no longer describe the code:

* SCRUM-162 AC7 supersedes SCRUM-72 AC2 (one venue), and says so in its Supersedes line, but SCRUM-72 has no note. It also supersedes SCRUM-76 AC1's one venue (TC-76-01 says so), which neither story records.
* SCRUM-171 AC4 narrows SCRUM-72 AC1 and AC8 and SCRUM-73 AC6 (an event whose Registration needed is No isn't listed, opened or opened for registration). SCRUM-171 has no Supersedes line and SCRUM-73 doesn't mention it.
* SCRUM-85 AC8 and AC9 (from SCRUM-133) extend SCRUM-76 AC2's statuses and let a registered Attendee open an event being re-planned, an exception to SCRUM-72 AC7 and AC8. Only Boundary and Related notes say so, and SCRUM-85 has no Supersedes line.
* SCRUM-75's 8 Oct refinement removed setting the registration window, but SCRUM-73 AC6 and its Business rule, and docs/testing/SCRUM-73.md, still say the window is set in SCRUM-75.
* SCRUM-76 and SCRUM-77 carry Related notes that are no longer true (the SCRUM-42 page name, fixed by SCRUM-146; AC3, AC4 and AC6 "remain", though the story is Done).
* docs/testing TC-75-14 is retired for SCRUM-128 AC11 but doesn't cite the case that replaced it (TC-128-16), as SCRUM-203 AC1 asks.

Done stories are not reopened: only notes, Supersedes lines and change logs are edited, never a Done story's user story, criteria or title.

Out of scope: SCRUM-212 AC1 lists four registration states, while SCRUM-75 AC7 and the merged code (#310) also show "Not open yet" with the opening time. That is raised with the story's owner (Caylern) and the PO (Hann Qian) separately.

**Acceptance criteria**

1. SCRUM-72, SCRUM-73 and SCRUM-76 each carry a "Superseded in part" note naming the criterion and the story that changed it; their criteria and titles are unchanged.
2. SCRUM-171 and SCRUM-85 carry a Supersedes line for the criteria they changed, and SCRUM-162's names SCRUM-76 AC1.
3. The out-of-date Related sentences in SCRUM-76 and SCRUM-77 are removed.
4. Every edit has a dated change-log line, and the Product Owner (Hann Qian) approves the wording.
5. docs/testing/SCRUM-75.md TC-75-14 cites TC-128-16, docs/testing/SCRUM-73.md no longer says the window is set in SCRUM-75, and docs/backlog is re-synced from Jira for every item changed; the PR is docs-only.

**Change log**

* 2026-10-29: SCRUM-212 AC1 taken out of scope, to be raised with Caylern and Hann Qian instead; its Jira edit was reverted.
* 2026-10-29: a second pass of the epic added SCRUM-76 AC1 (SCRUM-162), SCRUM-85's changes to SCRUM-72 and SCRUM-76, and the SCRUM-73 test-doc note.
