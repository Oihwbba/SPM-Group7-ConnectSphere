<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-29. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-126 - Coordinator decides whether a rejected request is amended or submitted as new

| | |
|---|---|
| **Type** | Story |
| **Epic** | SCRUM-6 - Event Request Lifecycle |
| **Priority** | Medium |
| **Story points** | 2 |
| **Status in Jira** | Done |
| **Sprint** | SCRUM Sprint 2 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-126 |

---

**User story:** As an Event Coordinator, I want to decide, when I reject a request, whether the Organiser amends it or starts a new one, so that rejected requests are only reworked when that makes sense.

**Acceptance criteria**

1. Given I reject an event request (SCRUM-19) or a Planning event (SCRUM-117), when I confirm the rejection, then I must choose one outcome, Amend and resubmit or Submit as a new request, in addition to the reason.
2. Given I chose Amend and resubmit, then the Organiser sees the Amend and Resubmit action on the same event (SCRUM-108).
3. Given I chose Submit as a new request, then Amend and Resubmit is not offered, and the rejected event stays Rejected and read-only.
4. Given I chose Submit as a new request, then the Organiser can choose Start a new request from this one, which creates a new Draft with the rejected event's details copied and no link to its bookings, equipment requests, reservations or history.
5. The Organiser sees the chosen outcome together with the reason.
6. The outcome is recorded in the event history with who and when.
7. Rejections recorded before this story was delivered are treated as Amend and resubmit.

**Supersedes:** SCRUM-19 AC3 (a rejection records only a reason) and AC4 (every Rejected request can be amended and resubmitted), which now holds only when the Coordinator chose Amend and resubmit.

**Customer basis:** "Only edits via Coordinator and the co-ordinator also decide whether it calls for a new submission." (Event Review and Approval). "Rejected events may be resubmitted after appropriate changes are made; rejection is not necessarily final."

**Why this is a new story:** SCRUM-19 (Sprint 1, Done) records a rejection without this choice, and the Sprint 1 code offers Amend & Resubmit on every rejected request. Done stories are not reopened, so the change lives here.

**Change log**

* 2026-10-01 (audit): moved into Sprint 2 because SCRUM-108 and SCRUM-117 depend on it. AC4 names equipment requests and reservations (the built equipment model).
* 2026-10-29 (SCRUM-243, PO approval pending): added the Supersedes line for SCRUM-19 AC3 and AC4, which AC1 to AC3 already changed; SCRUM-19 now carries a matching note. Criteria unchanged.

Functionality Area: Event Review and Approval
