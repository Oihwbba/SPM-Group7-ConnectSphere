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
       ├─ coordinates ─────────►        │                       └──► VenueUnavailability
       ├─ decides / cancels ───►        │
       ├─ registers ───────────►        ├──► Registration
       └─ is notified ─────────►        │
                                        ├──► EquipmentRequest ──► EquipmentRequestLine ──► Equipment
                                        │         └──────────────► EquipmentRequestUpdate      └──► EquipmentUnavailability
                                        ├──► Reservation ─────────────────────────────────► Equipment
                                        ├──► ClarificationRequest
                                        ├──► EventChangeRequest ──► ChangeRequestField
                                        └──► Notification

AuditLog ──► (entityType, entityId) — any of the above, by reference not by FK
```

`Event` is the hub: nine of the twelve domain tables hang off it. That is a
deliberate consequence of the customer's own framing — everything in
ConnectSphere happens *to an event*.

---

## 2. Table by table

### Identity and access

| Table | Purpose | Stories |
|---|---|---|
| `User` | One row per person, with exactly one `role`. Passwords are bcrypt hashes; account creation is out of Release-1 scope (open customer question), so users arrive via the seed. | SCRUM-65, 66, 67 |
| `Account`, `Session`, `VerificationToken` | Auth.js adapter tables. Unused today (we use JWT sessions — see `adr/0002`) but kept so an OAuth provider can be added without a migration. | — |
| `AuditLog` | Append-only: who did what, when, and the before/after value. No `updatedAt` on purpose — entries "cannot be edited or deleted through the application". | SCRUM-71, and SCRUM-21's "a record exists of who was previously assigned" |

### Event lifecycle

| Table | Purpose | Stories |
|---|---|---|
| `Event` | The request and everything it becomes. Carries the nine-value `status`, the SCRUM-13 form fields, and the decision/cancellation/completion timestamps and reasons. A rejection also carries its `rejectionOutcome` (Amend and resubmit, or Submit as a new request), which the database requires (ADR 0013). | SCRUM-13–26, 81–84, 126 |
| `ClarificationRequest` | A coordinator's question and the organiser's answer. | SCRUM-18, 56 |
| `EventChangeRequest` | An organiser's post-submission change request, with its decision. | SCRUM-41, 42, 43, 47 |
| `ChangeRequestField` | One row per changed field, holding `oldValue`, `newValue` and `isMajor`. | SCRUM-42, 44 |

### Venues

| Table | Purpose | Stories |
|---|---|---|
| `Venue` | The catalogue: capacity, facilities, accessibility features, supported layouts, operating hours. Retired with `isActive`, never deleted, so historic bookings stay readable. | SCRUM-34, 35, 38, 39, 40, 49 |
| `VenueUnavailability` | Non-booking unavailability — maintenance, closures. Kept separate from `Booking` because SCRUM-36 requires the two to be *visually distinguishable*. | SCRUM-36, 37 |
| `Booking` | A venue booking request and its outcome. Carries its own `startAt`/`endAt` (see §4.1). | SCRUM-50, 51, 52, 53, 54 |

### Equipment

| Table | Purpose | Stories |
|---|---|---|
| `Equipment` | A pooled *type* with a `totalQuantity`, not an individual asset (see §4.3). | SCRUM-27, 28 |
| `EquipmentUnavailability` | A quantity of a type out of service for a period. Quantity-scoped, so three of ten projectors can be in for repair. | SCRUM-29, 30 |
| `EquipmentRequest` | The coordinator's request header, with its review status. | SCRUM-27, 28 |
| `EquipmentRequestLine` | One line per equipment type, with quantity and free-text technical requirements, plus an optional suggested alternative. | SCRUM-27, 28 |
| `EquipmentRequestUpdate` | Append-only status history for a request. | SCRUM-28 |
| `Reservation` | Committed equipment for an event and period. | SCRUM-31, 32, 33 |

### Attendees and notifications

| Table | Purpose | Stories |
|---|---|---|
| `Registration` | One row per attendee per event. Withdrawal is a status change plus `withdrawnAt`, never a delete, so the event's registration history stays complete. | SCRUM-70, 72–78 |
| `Notification` | One row per notification, with a closed `NotificationType` enum so every notification in the system has a named, traceable trigger. | SCRUM-45, 46, 47, 48, 54, 56, 57, 85 |

---

## 3. The twenty Release-1 features → the tables that carry them

| # | Feature | Tables |
|---|---|---|
| 1 | User authorisation and authentication | `User` (+ `lib/auth/can.ts`) |
| 2 | Event request creation | `Event` |
| 3 | Draft event requests | `Event.status = DRAFT` |
| 4 | Event review and approval | `Event`, `ClarificationRequest` |
| 5 | Coordinator assignment | `Event.coordinatorId`, `AuditLog` |
| 6 | Event status management | `Event.status` + the lifecycle timestamps |
| 7 | Event information management | `Event`, `AuditLog` |
| 8 | Venue catalogue | `Venue` |
| 9 | Venue availability calendar | `Booking`, `VenueUnavailability` |
| 10 | Venue search and filtering | `Venue` (`facilities`, `accessibilityFeatures`, `supportedLayouts`) |
| 11 | Venue suitability checking | `Venue.capacity`, `Event.requiredFacilities` |
| 12 | Venue booking request | `Booking` (`PENDING`) |
| 13 | Venue booking approval | `Booking` (`APPROVED`/`REJECTED` + `decisionReason`) |
| 14 | Booking conflict detection | the `booking_no_double_booking` EXCLUDE constraint |
| 15 | Equipment request management | `EquipmentRequest`, `EquipmentRequestLine`, `EquipmentRequestUpdate` |
| 16 | Equipment availability checking | `Equipment`, `Reservation`, `EquipmentUnavailability` |
| 17 | Equipment reservation | `Reservation` |
| 18 | Attendee registration | `Registration`, `Event.registration*` |
| 19 | Event change requests | `EventChangeRequest`, `ChangeRequestField`, the `needsReconsideration` flags |
| 20 | Notification system | `Notification` |

---

## 4. Decisions worth being able to defend

### 4.1 Bookings and reservations store their own times

`Booking` and `Reservation` each copy `startAt`/`endAt` from the event rather
than joining to it. That is deliberate denormalisation, and `adr/0003` is the
full argument: if a booking always read the event's current time, it would
silently follow the event when the date moved, and the "this arrangement was
made against an earlier version" signal that SCRUM-26 and SCRUM-44 need would
be gone.

### 4.2 "Awaiting clarification" is not a tenth status

SCRUM-18 says the request's status should reflect that a response is needed.
SCRUM-23 fixes the status list at exactly nine values, and SCRUM-24 makes that
list the single source of truth. Adding a tenth would contradict both.

So an open clarification is a `ClarificationRequest` row with
`status = OPEN` while the event stays `UNDER_REVIEW`. The screen shows
"awaiting clarification"; the status field does not.

*This is an open customer question* — see `SPM-IS212-CustomerQA-Questions.md`,
Q3. If the customer says it should be a real status, it becomes a tenth enum
value and this table keeps only the message and response.

### 4.3 Equipment is a counted pool, not individual assets

`Equipment` is a *type* ("Projector") with a `totalQuantity`, not one row per
physical projector. Availability is
`totalQuantity − reserved − unavailable` over a period.

Nothing in the backlog asks to identify a specific unit — SCRUM-27 says "select
the equipment type from a predefined system list", and SCRUM-29 asks for "the
total available quantity". Per-asset tracking would mean serial numbers, asset
tags and an assignment table, all for a requirement nobody stated.

The cost of this choice is real and worth stating: because a pool has no
identity, overlap alone is not a conflict, so equipment cannot use the same
EXCLUDE constraint that protects venues. That is why §4.4 exists.

### 4.4 Why two rules are locks rather than constraints

| Rule | How it is enforced | Why |
|---|---|---|
| A venue is never double-booked (SCRUM-53, ADR 0010) | `EXCLUDE USING gist` on approved bookings | A venue is a single resource: any overlap is a conflict, which is exactly what an exclusion constraint expresses. |
| A venue is never both booked and unavailable (SCRUM-37, ADR 0010) | Triggers that lock the `Venue` row, then check the other table | An exclusion constraint sees one table; bookings and recorded unavailability are two. |
| Equipment is never over-allocated (SCRUM-31) | `SELECT … FOR UPDATE` on the `Equipment` row | Overlapping reservations are *legal* until the sum exceeds the pool. A constraint cannot express "the sum of overlapping rows must not exceed a column on another table". |
| An event is never oversubscribed (SCRUM-74) | `SELECT … FOR UPDATE` on the `Event` row | Same shape: capacity is a count, not a slot. |

Both locks must be taken inside the transaction that writes the row. Reading
the count first and inserting afterwards is the bug those two stories'
"at the same moment" criteria are written to catch.

### 4.5 Registration capacity is its own number

`Event.registrationCapacity` is stored per event and is **not** derived from
the venue's capacity. SCRUM-74's final criterion says so explicitly. The two
differ in practice — a 500-seat auditorium can host an event that only wants
120 registrations.

*Also an open customer question* (Q&A doc). If the customer says capacity is
always the venue's, this column becomes derived and the constraint moves.

---

## 5. Deliberately not modelled

These have no tables, on purpose. Adding them would be scope the customer
excluded from Release 1.

| Not modelled | Why |
|---|---|
| Waitlists (SCRUM-79) | Marked "beyond first release" in the story itself. |
| Attendance on the day (SCRUM-80) | Same. |
| Equipment catalogue maintenance as a feature | On the Week 4 "not required" list. `Equipment` rows exist; managing them is a seed/admin concern. |
| Event categories, agendas, recurring events, attachments, comments, tentative holds, room layouts as entities, reporting | All on the Week 4 "not required for Release 1" list. |

If a customer answer brings one of these into scope, add it as a new migration
and a new row in the §3 table — do not smuggle it into an existing table.

---

## 6. Adding to the model

1. Find the story. If there isn't one, stop and write it first.
2. Announce the change at standup — `schema.prisma` is a shared merge surface.
3. Edit `prisma/schema.prisma`, then `npm run db:migrate` to generate the
   migration. Never `prisma db push`.
4. If the rule is a data-integrity rule, write it as a CHECK, unique index or
   EXCLUDE constraint in the migration, not only in a server action. Put it
   below the `Domain constraints Prisma cannot express` banner and name its
   story in a comment.
5. Add seed data that makes the new rule demonstrable, and say in a comment
   which story it demonstrates.
6. Update §2 and §3 of this document in the same pull request.
