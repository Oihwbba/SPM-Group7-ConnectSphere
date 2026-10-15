# ConnectSphere data model

What every table is for, which user story asked for it, and the reasoning
behind the decisions most likely to be questioned. Read this before adding a
column.

The rule this document exists to enforce: **every field traces to an acceptance
criterion.** If you cannot name the story that needs a column, it does not go
in.

---

## 1. Entity map

```
User ──┬─ organises ──────────► Event ──┬──► Booking ────────► Venue
       ├─ coordinates ─────────►        │    │                  └──► VenueUnavailability
       ├─ supervises (Lead) ───►        │    └──► HoldExpiryChange    (Week 9, SCRUM-172)
       ├─ decides / cancels ───►        │
       ├─ registers ───────────►        ├──► Registration
       └─ is notified ─────────►        │
                                        ├──► EquipmentRequest ──► EquipmentRequestLine ──► Equipment
                                        │         └──────────────► EquipmentRequestUpdate       └──► EquipmentUnavailability
                                        ├──► Reservation ─────────────────────────────────► Equipment
                                        ├──► ClarificationRequest
                                        ├──► EventChangeRequest ──► ChangeRequestField
                                        ├──► SafetyCheck                (Week 7, SCRUM-166)
                                        └──► Notification

AuditLog ──► (entityType, entityId) — any of the above, by reference not by FK
```

`Event` is the hub: most of the domain tables hang off it. That is a
deliberate consequence of the customer's own framing — everything in
ConnectSphere happens *to an event*.

The tables, columns and roles that carry the six Week 7 customer changes
(SCRUM-159 to 166, 170 and 171) were added by SCRUM-172 on 2026-10-08, in one migration and
a follow-up for the No equipment needed decision. They exist in the database
now; the behaviour that uses them arrives with each story. Each is marked
below. The Week 9 clarifications added three more on 2026-10-13 (SCRUM-172
AC12 to AC14), marked Week 9.

---

## 2. Table by table

### Identity and access

| Table | Purpose | Stories |
|---|---|---|
| `User` | One row per person, with a `role`. Passwords are bcrypt hashes; there is no account creation: accounts arrive from outside (SCRUM-153, closed as not needed), so users come from the seed. One role per account today; SCRUM-121 will let an account hold several, and its permissions become the union of those roles. | SCRUM-65, 66, 67, 121 |
| `Account`, `Session`, `VerificationToken` | Auth.js adapter tables. Unused today (we use JWT sessions — see `adr/0002`) but kept so an OAuth provider can be added without a migration. | — |
| `AuditLog` | Append-only: who did what, when, and the before/after value. No `updatedAt` on purpose — entries "cannot be edited or deleted through the application". | SCRUM-71, and SCRUM-21's "a record exists of who was previously assigned" |

**Roles.** The `Role` enum has seven values. Release 1's five are Organiser,
Coordinator, Venue Staff, Technical Support and Attendee. Week 7 adds two
internal roles, `COORDINATOR_LEAD` and `SAFETY_OFFICER` (SCRUM-164; SCRUM-172
added them to the database): the **Event Coordinator Lead**, who assigns and
reassigns requests from an unassigned queue (SCRUM-165), and the **Safety
Officer**, who reviews an event's arrangements before it can be confirmed
(SCRUM-166) and records the safety check's outcome: Approved, Changes
requested or Rejected. Neither can confirm, plan or edit an event, nor approve or reject an
event request, which is the Coordinator's decision (SCRUM-19); the Safety
Officer's approval doesn't confirm the event (SCRUM-166 AC14). Until those
stories land, each may only read its own notifications (`ROLE_ACTIONS` in
`lib/auth/can.ts`), and no seeded account holds either role.

### Event lifecycle

| Table | Purpose | Stories |
|---|---|---|
| `Event` | The request and everything it becomes. Carries the nine-value `status`, the SCRUM-13 form fields, and the decision/cancellation/completion timestamps and reasons. A rejection also carries its `rejectionOutcome` (Amend and resubmit, or Submit as a new request), which the database requires (ADR 0013). A discarded Draft keeps its row with `discardedAt` set and leaves the Organiser's list; the database keeps it a Draft. The Organiser's venue, accessibility and equipment answers stay free text, shown to the people planning (SCRUM-170). **Registration needed** is `registrationRequired`, a nullable Yes/No. SCRUM-171 (not built yet) will have the request form set it, require it to submit, keep a request's earlier free-text answer (`registrationNotes`) next to it, and keep an event that doesn't need registration closed to registration and unlisted to Attendees. Today the form never sets it, so it is empty on every event, and confirming an event treats empty as needing registration (`registrationRequired !== false`). The Coordinator's **No equipment needed** decision is `noEquipmentNeededAt` with who recorded it (`noEquipmentNeededById`), both set or neither (added by SCRUM-172). SCRUM-170 AC4 will record it and clear it when the equipment requirements change; nothing sets it yet. (Week 9; added by SCRUM-172 AC12.) The Event Coordinator Lead supervising the event is `supervisingLeadId`, empty on every existing event. SCRUM-165 AC11 will record it; nothing sets it yet. | SCRUM-13–26, 81, 82, 84, 126, 130, 165, 170, 171 |
| `ClarificationRequest` | A coordinator's question and the organiser's answer, and (`editableFields`) the request-form fields the answer may change (ADR 0014). | SCRUM-18, 108 |
| `EventChangeRequest` | An organiser's post-submission change request, with its decision. It changes fields, or asks for the event to be cancelled (`requestsCancellation`, with a required reason). At most one is Submitted per event: the partial unique index `event_change_request_one_submitted`. | SCRUM-41, 128, 45, 124 |
| `ChangeRequestField` | One row per changed field, holding `oldValue`, `newValue` and `isMajor`. | SCRUM-128, 26 |
| `SafetyCheck` | (Week 7, SCRUM-166; added by SCRUM-172.) One row per check, all kept, holding its state — Awaiting review, Approved, Changes requested, Rejected or Outdated — the Safety Officer's note, who recorded the outcome and when, and when it went out of date. An event has at most one check awaiting review. It is a step within Planning, not an extra event status. | SCRUM-166 |
| `SafetyCheckArrangement` | (Week 7.) The arrangements a Safety Officer picked for Changes requested: each row is exactly one venue booking or one equipment reservation, at most once per check. | SCRUM-166 |

### Venues

| Table | Purpose | Stories |
|---|---|---|
| `Venue` | The catalogue: capacity, facilities, accessibility features, supported layouts, opening hours. Retired with `isActive`, never deleted, so historic bookings stay readable. Week 7 (SCRUM-159, SCRUM-34) adds `setupMinutes`, `turnaroundMinutes` (whole minutes, default 0) and `knownRestrictions` (optional text for the Safety Officer). | SCRUM-34, 38, 40, 159 |
| `VenueOpeningHours` | A venue's opening hours for one day of the week in SGT (1 is Monday): an opening and a closing time in minutes after midnight, or neither when it is Closed that day (SCRUM-34 AC3). The closing time is after the opening time (CHECK `venue_opening_hours_valid`). A venue with no rows has no hours recorded (only venues from before SCRUM-34) and refuses no booking; `Venue.operatingHours` is the older free text, kept for existing data. Requests, holds and approvals outside a venue's hours are refused (SCRUM-34 AC7). | SCRUM-34, 38 |
| `VenueUnavailability` | Non-booking unavailability, such as maintenance or a renovation. Kept separate from `Booking` because SCRUM-36 requires the two to be *visually distinguishable*. Week 7 (the SCRUM-172 migration, for SCRUM-161) gave venues their own reason list — Maintenance, Equipment failure, Renovation, Safety concern and Other (`VenueUnavailabilityReason`; equipment keeps Damaged, SCRUM-29/30). SCRUM-161 will let it be recorded over future bookings, which are then flagged rather than refused; the database already allows it (SCRUM-172), but today the record action still refuses it. | SCRUM-36, 37, 161 |
| `Booking` | A venue booking request and its outcome. Carries its own `startAt`/`endAt` (see decision 4.1) plus the setup and turnaround minutes it was approved with (SCRUM-159 AC8). The database holds an event to one pending, held or approved booking per venue (SCRUM-162 AC2); until SCRUM-162 lands, the request action still allows one venue per event (SCRUM-50 AC8). Week 7 lets an event book several venues, each with its own attendance (SCRUM-162), and adds the Held and Expired statuses with `heldAt`, `holdExpiresAt` and `holdNote` (SCRUM-163). A hold blocks its venue only until its expiry, and can't be confirmed after it (ADR 0010, 2026-10-08 addendum). The row says Held until something writes it, so the application reads a hold past its expiry as Expired from the expiry itself (`lib/booking-holds.ts`). (Week 9; added by SCRUM-172 AC13.) Venue Staff approve a hold before its Coordinator confirms it (SCRUM-163 AC3, AC7), recorded as `holdApprovedAt` and `holdApprovedById`: both set or neither, only on a booking that was held and no earlier than it was (`booking_hold_approval_complete`), and kept once the hold is confirmed, released, rejected or expires. Venue Staff record it with the queue's Approve button, and only then can the Coordinator confirm the hold (SCRUM-163). The Needs Reconsideration flag carries its reason, when it was raised, and who resolved it and when (SCRUM-26). | SCRUM-26, 50, 52, 53, 159, 162, 163 |
| `HoldExpiryChange` | (Week 9; added by SCRUM-172 AC14.) One row per change to a hold's expiry: the old expiry, the new one, who changed it and when, so a hold's earlier deadlines aren't lost when `Booking.holdExpiresAt` changes. A change to the same expiry is refused (`hold_expiry_change_differs`). Nothing writes it yet; the Week 9 story that lets a hold's expiry be changed will. | SCRUM-163, 172 |
| `EventOperationalNote` | An operational note on an event, with its author and time. Permanent: the trigger `event_operational_note_permanent` refuses editing or deleting one (it lets a whole event's deletion cascade), and `event_operational_note_not_blank` a blank one. | SCRUM-25 |

### Equipment

| Table | Purpose | Stories |
|---|---|---|
| `Equipment` | A pooled *type* with a `totalQuantity`, not an individual asset (see decision 4.3). | SCRUM-27, 28 |
| `EquipmentUnavailability` | A quantity of a type out of service for a period. Quantity-scoped, so three of ten projectors can be in for repair. | SCRUM-29, 30 |
| `EquipmentRequest` | The coordinator's request header, with its review status (Pending Review, In Review, Approved, Rejected or Cancelled). Approving a request holds **no** stock: its status is separate from Reserved equipment, and only a reservation holds stock (decision 4.3b). | SCRUM-27, 28 |
| `EquipmentRequestLine` | One line per equipment type, with quantity and free-text technical requirements, plus an optional suggested alternative. A line the Coordinator removes is kept with `removedAt` set and left out by every reader (SCRUM-142); adding the type again brings the same row back. | SCRUM-27, 28, 142 |
| `EquipmentRequestUpdate` | Append-only status history for a request. | SCRUM-28 |
| `Reservation` | Committed equipment for an event and period — the only thing that holds stock. It is reserved from an approved equipment request (SCRUM-155), and `requestId` links it back so the system knows which of the request's lines are covered; the one-type form was made availability-only by SCRUM-156. Stored as `CONFIRMED`, shown everywhere as **Reserved** (SCRUM-131). | SCRUM-31, 155, 156 |

### Attendees and notifications

| Table | Purpose | Stories |
|---|---|---|
| `Registration` | One row per attendee per event. Withdrawal is a status change plus `withdrawnAt`, never a delete, so the event's registration history stays complete. Shown as Registered, Withdrawn or Cancelled. | SCRUM-70, 72–77 |
| `Notification` | One row per notification, with a closed `NotificationType` enum so every notification in the system has a named, traceable trigger. SCRUM-48 adds a `showFromAt` time so a hold reminder can be written ahead and appear on schedule without a job, and `withdrawnAt` so one that hasn't shown yet can be withdrawn without deleting it; `bookingId` names the hold it is about (SCRUM-124 AC5). Week 9 adds `HOLD_APPROVED`, which tells the Coordinator Venue Staff approved a hold for them to confirm (SCRUM-124 AC4). | SCRUM-45, 48, 85, 124 |

---

## 3. The twenty Release-1 features → the tables that carry them

| # | Feature | Tables |
|---|---|---|
| 1 | User authorisation and authentication | `User` (+ `lib/auth/can.ts`) |
| 2 | Event request creation | `Event` |
| 3 | Draft event requests | `Event.status = DRAFT`; discarded: `Event.discardedAt` (SCRUM-130) |
| 4 | Event review and approval | `Event`, `ClarificationRequest` |
| 5 | Coordinator assignment | `Event.coordinatorId`, `AuditLog`; unassigned queue and the Lead are SCRUM-165 |
| 6 | Event status management | `Event.status` + the lifecycle timestamps |
| 7 | Event information management | `Event`, `AuditLog` (operational notes: SCRUM-25) |
| 8 | Venue catalogue | `Venue` (setup and turnaround: SCRUM-159) |
| 9 | Venue availability calendar | `Booking`, `VenueUnavailability` (occupied periods: SCRUM-159) |
| 10 | Venue search and filtering | `Venue` (`facilities`, `accessibilityFeatures`, `supportedLayouts`) |
| 11 | Venue suitability checking | `Venue.capacity`, the event's attendance and needs |
| 12 | Venue booking request | `Booking` (`PENDING`); several venues per event (SCRUM-162) |
| 13 | Venue booking approval | `Booking` (`APPROVED`/`REJECTED`/`HELD` + `decisionReason`/hold expiry, SCRUM-163; Venue Staff's approval of a hold, `holdApprovedAt`, and its expiry history, `HoldExpiryChange`: Week 9) |
| 14 | Booking conflict detection | the `booking_no_double_booking` EXCLUDE constraint (occupied periods: SCRUM-159) |
| 15 | Equipment request management | `EquipmentRequest`, `EquipmentRequestLine`, `EquipmentRequestUpdate` |
| 16 | Equipment availability checking | `Equipment`, `Reservation`, `EquipmentUnavailability` |
| 17 | Equipment reservation | `Reservation` (linked to the request, SCRUM-155/156) |
| 18 | Attendee registration | `Registration`, `Event.registration*` |
| 19 | Event change requests | `EventChangeRequest`, `ChangeRequestField`, the `needsReconsideration` flags |
| 20 | Notification system | `Notification` |

**Week 7 (beyond the twenty, SCRUM-159–166, 170, 171):** venue setup and turnaround
times — `Venue.setupMinutes`/`turnaroundMinutes` and a booking's occupied
period (SCRUM-159, SCRUM-160); unavailability over existing bookings
(SCRUM-161); several venues per event, each booking checked independently
(SCRUM-162); tentative Held bookings that expire (SCRUM-163); the Lead and
Safety Officer roles and the Safety Officer's check (SCRUM-164, 165, 166).
The `needsReconsideration` flag that SCRUM-26 raises lives on `Booking` and
`Reservation`.

**Week 9 clarifications (SCRUM-172 AC12 to AC14):** the Lead supervising an
event (`Event.supervisingLeadId`, SCRUM-165 AC11); Venue Staff's approval of
a hold, which its Coordinator then confirms (`Booking.holdApprovedAt` and
`holdApprovedById`, SCRUM-163 AC3 and AC7); and the history of a hold's
expiry changes (`HoldExpiryChange`).

---

## 4. Decisions worth being able to defend

### 4.1 Bookings and reservations store their own times

`Booking` and `Reservation` each copy `startAt`/`endAt` from the event rather
than joining to it. That is deliberate denormalisation, and `adr/0003` is the
full argument: if a booking always read the event's current time, it would
silently follow the event when the date moved, and the "this arrangement was
made against an earlier version" signal that SCRUM-26 needs would
be gone.

### 4.2 "Awaiting clarification" is not a tenth status

SCRUM-18 says the request's status should reflect that a response is needed.
SCRUM-23 fixes the status list at exactly nine values, and SCRUM-24 makes that
list the single source of truth. Adding a tenth would contradict both.

So an open clarification is a `ClarificationRequest` row with
`status = OPEN` while the event stays `UNDER_REVIEW`. The screen shows
"awaiting clarification"; the status field does not. The Week 7 safety check
(SCRUM-166) follows the same rule: it is a step within Planning, not an event
status.

*This is an open customer question* (question 3 in the customer Q&A document
in the team's
[shared Google Drive folder](https://drive.google.com/drive/folders/1G4cNyWOcldw0iawiJfmJ1WbCiy_YZbv0)).
If the customer says it should be a real status, it becomes a tenth enum value
and this table keeps only the message and response.

### 4.3 Equipment is a counted pool, not individual assets

`Equipment` is a *type* ("Projector") with a `totalQuantity`, not one row per
physical projector. Availability is
`totalQuantity − reserved − unavailable` over a period.

Nothing in the backlog asks to identify a specific unit — SCRUM-27 says "select
the equipment type from a predefined system list", and SCRUM-29 asks for "the
total available quantity". Per-asset tracking would mean serial numbers, asset
tags and an assignment table, all for a requirement nobody stated.

**4.3b The request's status is separate from reserved stock.** Approving an
equipment request changes only its review status (SCRUM-28); it reserves
nothing. Stock is held only by a `Reservation`, created from an approved
request (SCRUM-155, which made the one-type form availability-only by
SCRUM-156). The readiness checklist (SCRUM-110) therefore counts reservations,
not approvals.

The cost of the pool choice is real and worth stating: because a pool has no
identity, overlap alone is not a conflict, so equipment cannot use the same
EXCLUDE constraint that protects venues. That is why decision 4.4 exists.

### 4.4 Why two rules are locks rather than constraints

| Rule | How it is enforced | Why |
|---|---|---|
| A venue is never double-booked (SCRUM-53, ADR 0010) | `EXCLUDE USING gist` on approved and held bookings, over their occupied periods (times widened by setup and turnaround, SCRUM-159) | A venue is a single resource: any overlap is a conflict, which is exactly what an exclusion constraint expresses. |
| A venue is never both booked and unavailable (SCRUM-37, ADR 0010) | Triggers that lock the `Venue` row, then check the other table | An exclusion constraint sees one table; bookings and recorded unavailability are two. Since SCRUM-172 the trigger on unavailability refuses only overlapping unavailability; until SCRUM-161 flags bookings instead, the record action keeps refusing unavailability over a booking, under the same venue lock. |
| Equipment is never over-allocated (SCRUM-31, 155) | `SELECT … FOR UPDATE` on the `Equipment` rows, in id order, after the `Event` row | Overlapping reservations are *legal* until the sum exceeds the pool. A constraint cannot express "the sum of overlapping rows must not exceed a column on another table". |
| An event is never oversubscribed (SCRUM-74) | `SELECT … FOR UPDATE` on the `Event` row | Same shape: capacity is a count, not a slot. |
| An event has at most one Submitted change request (SCRUM-41) | `SELECT … FOR UPDATE` on the `Event` row, backed by a partial unique index | The index alone would turn the loser of two simultaneous requests into a database error; the lock lets it see the winner and get the ordinary "already has a change request" answer. |

Both locks must be taken inside the transaction that writes the row. Reading
the count first and inserting afterwards is the bug those two stories'
"at the same moment" criteria are written to catch.

### 4.5 Registration capacity is the event's expected attendance

SCRUM-74, as re-written in Jira: "For Release 1, registration capacity equals
the event's expected attendance; no separate registration-capacity field is
maintained." Registration therefore counts against `Event.expectedAttendance`,
under a lock on the `Event` row (decision 4.4). The leftover
`Event.registrationCapacity` column — from the earlier wording where capacity
was a separate number — is unused.

### 4.6 Display names follow one convention (SCRUM-131)

Stored values need not read as the user sees them. The agreed display names:

| Domain | Shown as |
|---|---|
| Event | Draft, Submitted, Under Review, Approved, Planning, Confirmed, Completed, Cancelled, Rejected |
| Booking | Pending, Held, Approved, Rejected, Expired, Cancelled |
| Equipment request | Pending Review, In Review, Approved, Rejected, Cancelled |
| Reservation | **Reserved** or Cancelled — never "Confirmed" (a reservation's stored `CONFIRMED` status collides with the event's Confirmed) |
| Registration | Registered, Withdrawn, Cancelled |
| Change request | Submitted, Approved, Rejected |
| Safety check | Not requested, Awaiting review, Approved, Changes requested, Rejected, Outdated |

---

## 5. Deliberately not modelled

These have no tables, on purpose. Adding them would be scope the customer
excluded from Release 1.

| Not modelled | Why |
|---|---|
| Waiting lists (SCRUM-79) | Kept out by the team's 13 Sep customer Q&A answer, and on the Week 4 not-required list. A place that opens offers nothing automatically; the waitlist is a later addition. |
| Attendance on the day (SCRUM-80) | Marked beyond Release 1; Release 1 will record a headcount at completion (SCRUM-82, not built; no column yet). |
| Equipment catalogue maintenance as a feature | On the Week 4 "not required" list (SCRUM-119 is beyond Release 1). `Equipment` rows exist; managing them is a seed/admin concern. |
| Client organisations as data | Accounts arrive from an outside integration, so there is no sign-up (SCRUM-153, closed as not needed); organisation-wide viewing is beyond Release 1. |
| Event categories, agendas, recurring events, attachments, comments, room layouts as entities, reporting | All on the Week 4 "not required for Release 1" list. |

If a customer answer brings one of these into scope, add it as a new migration
and a new row in the table in section 3. Don't smuggle it into an existing table.

---

## 6. Adding to the model

1. Find the story. If there isn't one, stop and write it first.
2. Announce the change at standup — `schema.prisma` is a shared merge surface.
3. Edit `prisma/schema.prisma`, then generate the migration with
   `npm run db:migrate` (`prisma migrate dev`) against the **local Docker
   database only** (README, "Local database (Docker)"). Never run it while
   `.env` points at Supabase, and never `prisma db push`.
4. If the rule is a data-integrity rule, write it as a CHECK, unique index or
   EXCLUDE constraint in your new migration, not only in a server action. Put
   it after Prisma's generated statements and name its story in a comment.
   (The `Domain constraints Prisma cannot express` banner is in the first
   migration, which must never be edited.)
5. Add seed data that makes the new rule demonstrable, and say in a comment
   which story it demonstrates.
6. Update sections 2 and 3 of this document in the same pull request.