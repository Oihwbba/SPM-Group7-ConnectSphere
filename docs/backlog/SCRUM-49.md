<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-09-21. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-49 - Show Reason for Unsuitability

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Medium |
| **Story points** | 1 |
| **Status in Jira** | To Do |
| **Sprint** | Backlog |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-49 |

---

**User Story**
As an Event Coordinator, I want to see the specific reason a venue is flagged unsuitable, so that I understand why before deciding whether to proceed.

**Acceptance Criteria**

* Reason(s) displayed, naming the mismatch and both values where relevant — e.g. "Capacity 100 < expected attendance 150", "Missing facility: AV equipment".
* Reasons cover all four suitability dimensions in SCRUM-40: capacity, required facilities, **accessibility** and **supported layout** — e.g. "No wheelchair access; event requires step-free entry", "Venue does not support banquet layout".
* Multiple reasons are all listed if more than one applies.
* Given a venue is suitable, when the Coordinator views it, then no unsuitability reasons are shown.

**Note (2026-09-13):** the accessibility and layout reasons follow from the customer's answer on SCRUM-40 — _"Yes, accessibility/layout mismatches count and should be reflected by the co-ordinator on suitability."_ A venue can now be marked unsuitable for reasons this story previously had no vocabulary to explain. The suitable-side criterion was added so the story states behaviour on both sides of the flag.
