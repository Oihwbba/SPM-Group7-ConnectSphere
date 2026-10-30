<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Synced from Jira on 2026-10-30. Jira is the source of truth.
     To refresh: see docs/backlog/README.md -->

# SCRUM-253 - Chore: Every venue has opening hours: give old venues hours and refuse a venue without them

| | |
|---|---|
| **Type** | Task |
| **Epic** | SCRUM-7 - Venue Management |
| **Priority** | Medium |
| **Story points** | - |
| **Status in Jira** | In Progress |
| **Sprint** | SCRUM Sprint 4 |
| **Jira** | https://smu-spm-group7.atlassian.net/browse/SCRUM-253 |

---

Creating or editing a venue requires opening hours for all seven days (SCRUM-34 AC3), and the seed gives every venue its week. The SCRUM-34 audit note says existing venues' hours are re-entered in the new format. No story asks for a venue with no hours.

The code still allows one. The opening-hours migration (`20261015120000_venue_opening_hours`) left any venue whose old free-text hours it couldn't read with no hours rows, and several places treat such a venue as a special case:

* booking refuses nothing for it (`dayOutsideOpeningHours`, SCRUM-34 AC7);
* venue search treats it as never closed (`closedOn`, SCRUM-38 AC4);
* the setup and turnaround warning skips it (`setupTurnaroundWarning`, SCRUM-159 AC9);
* the venue page shows "Not recorded yet (previously noted: …)" from the old `Venue.operatingHours` text, and the venue form says "This venue's opening hours aren't recorded yet."

The GLM reviewer flagged the inconsistency on PR #323 (SCRUM-246). Found on 30 Oct.

**Acceptance criteria**

1. A migration gives every venue that has no opening hours rows 00:00–24:00 on all seven days, which keeps how it was treated (nothing refused). Venue Staff can then set its real hours in the venue form. A venue that already has rows is unchanged.
2. The database refuses, when a transaction commits, any venue that doesn't have an hours row for each of the seven days: a venue created without them, or a day's row deleted.
3. No code treats a venue as having no opening hours. Booking (SCRUM-34 AC7), venue search (SCRUM-38 AC4), the setup and turnaround warning (SCRUM-159 AC9), the venue page and the venue form read every venue's hours the same way, and a weekday without a row reads as Closed.
4. The app and the seed no longer read or write the old free-text `Venue.operatingHours`. The column itself is dropped in a second pull request once the first is deployed, because migrations reach the shared database while the previous build is still serving (README, "Migration rules").
5. The tests and the test cases for SCRUM-34, SCRUM-38 and SCRUM-159 no longer describe a venue with no hours, and test fixtures create venues with their hours.

**Change log**

* 2026-10-30: created from the review of PR #323 (SCRUM-246).
