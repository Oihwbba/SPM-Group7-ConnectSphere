-- SCRUM-172 — every schema and database-rule change the Week 7 stories need,
-- in one migration, so the stories that build on it (SCRUM-26, 48, 124, 127,
-- 159, 161, 162, 163, 164, 166) don't write clashing migrations in parallel.
-- Each story still builds its own behaviour on top; this adds the columns,
-- tables and rules, and changes no behaviour beyond the booking rules (AC9).
--
-- Sections follow the acceptance criteria. The booking rules are explained in
-- docs/adr/0010, 2026-10-08 addendum.

-- ===========================================================================
-- AC1 — the Event Coordinator Lead and Safety Officer roles (SCRUM-164)
-- ===========================================================================

ALTER TYPE "Role" ADD VALUE 'COORDINATOR_LEAD';
ALTER TYPE "Role" ADD VALUE 'SAFETY_OFFICER';

-- ===========================================================================
-- AC2 — venue setup and turnaround time, and known restrictions
-- (SCRUM-159 AC1, SCRUM-34 AC3). Existing venues start at 0 and 0.
-- ===========================================================================

ALTER TABLE "Venue" ADD COLUMN "setupMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "turnaroundMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "knownRestrictions" TEXT;

-- SCRUM-159 AC1: whole minutes from 0 to 1,440.
ALTER TABLE "Venue" ADD CONSTRAINT "venue_setup_turnaround_range"
  CHECK ("setupMinutes" BETWEEN 0 AND 1440
         AND "turnaroundMinutes" BETWEEN 0 AND 1440);

-- ===========================================================================
-- AC3 — Held and Expired bookings, a hold's expiry and note (SCRUM-163), and
-- the setup and turnaround minutes a booking was held or approved with
-- (SCRUM-159 AC8)
-- ===========================================================================

-- The rules below name 'HELD', and PostgreSQL refuses a value added with
-- ALTER TYPE ... ADD VALUE in the transaction that adds it. So the type is
-- rebuilt instead, which first needs the rules that read "status" out of the
-- way. They are recreated, for occupied periods, in AC9;
-- booking_rejection_has_reason comes back unchanged.
DROP TRIGGER "booking_overlaps_unavailability" ON "Booking";
ALTER TABLE "Booking" DROP CONSTRAINT "booking_no_double_booking";
ALTER TABLE "Booking" DROP CONSTRAINT "booking_one_venue_per_event";
ALTER TABLE "Booking" DROP CONSTRAINT "booking_rejection_has_reason";

ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";
CREATE TYPE "BookingStatus" AS ENUM
  ('PENDING', 'HELD', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED');
-- AC10: every existing booking keeps its status.
ALTER TABLE "Booking"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "BookingStatus" USING ("status"::text::"BookingStatus"),
  ALTER COLUMN "status" SET DEFAULT 'PENDING';
DROP TYPE "BookingStatus_old";

-- SCRUM-53, as before: a rejection cannot be saved without a reason.
ALTER TABLE "Booking" ADD CONSTRAINT "booking_rejection_has_reason"
  CHECK ("status" <> 'REJECTED'
         OR ("decisionReason" IS NOT NULL AND btrim("decisionReason") <> ''));

ALTER TABLE "Booking" ADD COLUMN "heldAt" TIMESTAMP(3),
ADD COLUMN "holdExpiresAt" TIMESTAMP(3),
ADD COLUMN "holdNote" TEXT,
ADD COLUMN "setupMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "turnaroundMinutes" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Booking" ADD CONSTRAINT "booking_setup_turnaround_range"
  CHECK ("setupMinutes" BETWEEN 0 AND 1440
         AND "turnaroundMinutes" BETWEEN 0 AND 1440);

-- SCRUM-163 AC1: a hold has an expiry and a note of what the Coordinator must
-- finalise. An Expired booking was a hold, so it keeps them.
ALTER TABLE "Booking" ADD CONSTRAINT "booking_hold_complete"
  CHECK ("status" NOT IN ('HELD', 'EXPIRED')
         OR ("heldAt" IS NOT NULL
             AND "holdExpiresAt" IS NOT NULL
             AND "holdNote" IS NOT NULL AND btrim("holdNote") <> ''));

-- SCRUM-163 AC1: the expiry is later than the hold was placed and earlier
-- than the booking's start. ("Later than now" is checked when the hold is
-- placed; a CHECK can't read the clock.)
ALTER TABLE "Booking" ADD CONSTRAINT "booking_hold_period_valid"
  CHECK ("holdExpiresAt" IS NULL
         OR ("holdExpiresAt" < "startAt"
             AND ("heldAt" IS NULL OR "holdExpiresAt" > "heldAt")));

-- ===========================================================================
-- AC4 — the Needs Reconsideration flag fields on venue bookings and equipment
-- reservations (SCRUM-26): reason, raised when, resolved by and resolved when.
-- `needsReconsideration` and `reconsiderationFlaggedAt` (raised when) exist
-- already.
-- ===========================================================================

ALTER TABLE "Booking" ADD COLUMN "reconsiderationReason" TEXT,
ADD COLUMN "reconsiderationResolvedAt" TIMESTAMP(3),
ADD COLUMN "reconsiderationResolvedById" TEXT;

ALTER TABLE "Reservation" ADD COLUMN "reconsiderationReason" TEXT,
ADD COLUMN "reconsiderationResolvedAt" TIMESTAMP(3),
ADD COLUMN "reconsiderationResolvedById" TEXT;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_reconsiderationResolvedById_fkey"
  FOREIGN KEY ("reconsiderationResolvedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_reconsiderationResolvedById_fkey"
  FOREIGN KEY ("reconsiderationResolvedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Nothing raises the flag yet (SCRUM-44 was never built), so no row should
-- need these; they make the CHECKs below safe on any database regardless.
UPDATE "Booking"
   SET "reconsiderationReason" = 'Reason not recorded (pre-constraint data).',
       "reconsiderationFlaggedAt" = COALESCE("reconsiderationFlaggedAt", "updatedAt")
 WHERE "needsReconsideration";
UPDATE "Reservation"
   SET "reconsiderationReason" = 'Reason not recorded (pre-constraint data).',
       "reconsiderationFlaggedAt" = COALESCE("reconsiderationFlaggedAt", "updatedAt")
 WHERE "needsReconsideration";

-- A raised flag says why and when (SCRUM-161 AC3, SCRUM-166 AC10), and a
-- resolution records both who and when (SCRUM-26 AC7).
ALTER TABLE "Booking" ADD CONSTRAINT "booking_flag_has_reason"
  CHECK (NOT "needsReconsideration"
         OR ("reconsiderationFlaggedAt" IS NOT NULL
             AND "reconsiderationReason" IS NOT NULL
             AND btrim("reconsiderationReason") <> ''));
ALTER TABLE "Booking" ADD CONSTRAINT "booking_flag_resolution_complete"
  CHECK (("reconsiderationResolvedAt" IS NULL) = ("reconsiderationResolvedById" IS NULL));

ALTER TABLE "Reservation" ADD CONSTRAINT "reservation_flag_has_reason"
  CHECK (NOT "needsReconsideration"
         OR ("reconsiderationFlaggedAt" IS NOT NULL
             AND "reconsiderationReason" IS NOT NULL
             AND btrim("reconsiderationReason") <> ''));
ALTER TABLE "Reservation" ADD CONSTRAINT "reservation_flag_resolution_complete"
  CHECK (("reconsiderationResolvedAt" IS NULL) = ("reconsiderationResolvedById" IS NULL));

-- ===========================================================================
-- AC5 — venue unavailability reasons (SCRUM-161 AC1)
-- ===========================================================================

-- A type of its own: equipment unavailability keeps "UnavailabilityReason",
-- because SCRUM-29/30 still name "Damaged" and "Under maintenance".
CREATE TYPE "VenueUnavailabilityReason" AS ENUM
  ('MAINTENANCE', 'EQUIPMENT_FAILURE', 'RENOVATION', 'SAFETY_CONCERN', 'OTHER');

-- Closure has no new equivalent: it becomes Other, with "Closure" kept at the
-- start of the note.
UPDATE "VenueUnavailability"
   SET "note" = CASE WHEN "note" IS NULL OR btrim("note") = '' THEN 'Closure'
                     ELSE 'Closure: ' || "note" END
 WHERE "reason" = 'CLOSURE';

ALTER TABLE "VenueUnavailability"
  ALTER COLUMN "reason" DROP DEFAULT,
  ALTER COLUMN "reason" TYPE "VenueUnavailabilityReason" USING (
    CASE "reason"::text
      WHEN 'DAMAGED' THEN 'EQUIPMENT_FAILURE'
      WHEN 'CLOSURE' THEN 'OTHER'
      ELSE "reason"::text
    END::"VenueUnavailabilityReason"),
  ALTER COLUMN "reason" SET DEFAULT 'MAINTENANCE';

-- ===========================================================================
-- AC6 — the operational safety check (SCRUM-166)
-- ===========================================================================

CREATE TYPE "SafetyCheckStatus" AS ENUM
  ('AWAITING_REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED', 'OUTDATED');

CREATE TABLE "SafetyCheck" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "SafetyCheckStatus" NOT NULL DEFAULT 'AWAITING_REVIEW',
    "requestedById" TEXT NOT NULL,
    "note" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "outdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyCheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SafetyCheckArrangement" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "bookingId" TEXT,
    "reservationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyCheckArrangement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SafetyCheck_eventId_idx" ON "SafetyCheck"("eventId");
CREATE INDEX "SafetyCheck_status_idx" ON "SafetyCheck"("status");
CREATE INDEX "SafetyCheckArrangement_bookingId_idx" ON "SafetyCheckArrangement"("bookingId");
CREATE INDEX "SafetyCheckArrangement_reservationId_idx" ON "SafetyCheckArrangement"("reservationId");
CREATE UNIQUE INDEX "SafetyCheckArrangement_checkId_bookingId_key" ON "SafetyCheckArrangement"("checkId", "bookingId");
CREATE UNIQUE INDEX "SafetyCheckArrangement_checkId_reservationId_key" ON "SafetyCheckArrangement"("checkId", "reservationId");

ALTER TABLE "SafetyCheck" ADD CONSTRAINT "SafetyCheck_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SafetyCheck" ADD CONSTRAINT "SafetyCheck_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SafetyCheck" ADD CONSTRAINT "SafetyCheck_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SafetyCheckArrangement" ADD CONSTRAINT "SafetyCheckArrangement_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "SafetyCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SafetyCheckArrangement" ADD CONSTRAINT "SafetyCheckArrangement_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SafetyCheckArrangement" ADD CONSTRAINT "SafetyCheckArrangement_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AC3: Changes requested and Rejected need a note.
ALTER TABLE "SafetyCheck" ADD CONSTRAINT "safety_check_note_required"
  CHECK ("status" NOT IN ('CHANGES_REQUESTED', 'REJECTED')
         OR ("note" IS NOT NULL AND btrim("note") <> ''));

-- AC5: every outcome records who recorded it and when.
ALTER TABLE "SafetyCheck" ADD CONSTRAINT "safety_check_outcome_recorded"
  CHECK ("status" NOT IN ('APPROVED', 'CHANGES_REQUESTED', 'REJECTED')
         OR ("decidedById" IS NOT NULL AND "decidedAt" IS NOT NULL));

-- AC13: an Outdated check says when it went out of date.
ALTER TABLE "SafetyCheck" ADD CONSTRAINT "safety_check_outdated_has_time"
  CHECK ("status" <> 'OUTDATED' OR "outdatedAt" IS NOT NULL);

-- AC7: requesting a check while one is awaiting review shows the existing one,
-- so an event never has two awaiting review.
CREATE UNIQUE INDEX "safety_check_one_awaiting_per_event"
    ON "SafetyCheck"("eventId")
 WHERE ("status" = 'AWAITING_REVIEW');

-- AC3: each picked arrangement is one venue booking or one equipment
-- reservation, never both or neither.
ALTER TABLE "SafetyCheckArrangement" ADD CONSTRAINT "safety_check_arrangement_one_target"
  CHECK (num_nonnulls("bookingId", "reservationId") = 1);

-- ===========================================================================
-- AC7 — notifications with a show-from time, and the new notification types
-- (SCRUM-48 AC8, SCRUM-124)
-- ===========================================================================

ALTER TYPE "NotificationType" ADD VALUE 'BOOKING_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'EQUIPMENT_REQUEST_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'EQUIPMENT_REQUEST_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE 'BOOKING_REQUEST_WITHDRAWN';
ALTER TYPE "NotificationType" ADD VALUE 'EQUIPMENT_REQUEST_WITHDRAWN';
ALTER TYPE "NotificationType" ADD VALUE 'BOOKING_HELD';
ALTER TYPE "NotificationType" ADD VALUE 'HOLD_EXPIRY_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'HOLD_EXPIRED';
ALTER TYPE "NotificationType" ADD VALUE 'HOLD_CONFIRMED';
ALTER TYPE "NotificationType" ADD VALUE 'HOLD_RELEASED';
ALTER TYPE "NotificationType" ADD VALUE 'CHANGE_REQUEST_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'ARRANGEMENT_FLAGGED';
ALTER TYPE "NotificationType" ADD VALUE 'ARRANGEMENT_FLAG_RESOLVED';
ALTER TYPE "NotificationType" ADD VALUE 'REQUEST_AWAITING_ASSIGNMENT';
ALTER TYPE "NotificationType" ADD VALUE 'SAFETY_CHECK_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'SAFETY_CHECK_OUTCOME';

-- `bookingId` lets a hold's reminder and expiry notice be withdrawn when that
-- hold is settled first (SCRUM-124 AC5), and `withdrawnAt` withdraws one
-- without deleting it.
ALTER TABLE "Notification" ADD COLUMN "showFromAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "withdrawnAt" TIMESTAMP(3),
ADD COLUMN "bookingId" TEXT;

-- Existing notifications were shown when they were written.
UPDATE "Notification" SET "showFromAt" = "createdAt";

CREATE INDEX "Notification_userId_showFromAt_idx" ON "Notification"("userId", "showFromAt");
CREATE INDEX "Notification_bookingId_idx" ON "Notification"("bookingId");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===========================================================================
-- AC8 — the quantity of each equipment type the Organiser chooses (SCRUM-127)
-- ===========================================================================

CREATE TABLE "EventEquipmentNeed" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventEquipmentNeed_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventEquipmentNeed_equipmentId_idx" ON "EventEquipmentNeed"("equipmentId");
-- SCRUM-127 AC2: each type once, with its quantity.
CREATE UNIQUE INDEX "EventEquipmentNeed_eventId_equipmentId_key" ON "EventEquipmentNeed"("eventId", "equipmentId");

ALTER TABLE "EventEquipmentNeed" ADD CONSTRAINT "EventEquipmentNeed_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventEquipmentNeed" ADD CONSTRAINT "EventEquipmentNeed_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SCRUM-127 AC2: a quantity of at least 1.
ALTER TABLE "EventEquipmentNeed" ADD CONSTRAINT "event_equipment_need_quantity_positive"
  CHECK ("quantity" > 0);

-- ===========================================================================
-- AC9 — the booking rules use occupied periods (SCRUM-159, 161, 162, 163)
-- ===========================================================================

-- SCRUM-159 AC2: a booking occupies its venue from its start minus its setup
-- minutes to its end plus its turnaround minutes. Half-open, so occupied
-- periods that only touch don't conflict (AC4). The minutes are the
-- booking's own, copied when it is held or approved (AC8), so a later change
-- to the venue's minutes doesn't move it. Existing bookings have 0 and 0, so
-- their occupied period is their booked period and nothing they already
-- satisfied changes. IMMUTABLE so the EXCLUDE constraint can index it.
CREATE FUNCTION booking_occupied_period(
  start_at TIMESTAMP(3),
  end_at TIMESTAMP(3),
  setup_minutes INTEGER,
  turnaround_minutes INTEGER
) RETURNS tsrange
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT tsrange(start_at - make_interval(mins => setup_minutes),
                 end_at + make_interval(mins => turnaround_minutes),
                 '[)')
$$;

-- No two Approved or Held bookings at a venue have overlapping occupied
-- periods (SCRUM-159 AC3 and AC5, SCRUM-163 AC2). Same name as the constraint
-- it replaces, which compared bare periods of Approved bookings only, so the
-- application recognises the refusal unchanged.
ALTER TABLE "Booking" ADD CONSTRAINT "booking_no_double_booking"
  EXCLUDE USING gist (
    "venueId" WITH =,
    booking_occupied_period("startAt", "endAt", "setupMinutes", "turnaroundMinutes") WITH &&
  ) WHERE ("status" IN ('APPROVED', 'HELD'));

-- An event has at most one Pending, Held or Approved booking per venue
-- (SCRUM-162 AC2 and AC6). It replaces booking_one_venue_per_event (one per
-- event, whatever the venue, SCRUM-50 AC8), so an event can book several
-- venues. Rejected, Cancelled and Expired bookings don't count.
ALTER TABLE "Booking" ADD CONSTRAINT "booking_one_per_venue_per_event"
  EXCLUDE USING gist ("eventId" WITH =, "venueId" WITH =)
  WHERE ("status" IN ('PENDING', 'HELD', 'APPROVED'));

-- No Approved or Held booking overlaps recorded unavailability (SCRUM-161
-- AC6, SCRUM-163 AC2), compared on the booking's occupied period.
--
-- A hold reserves the venue only until its expiry (SCRUM-163 AC4), whether or
-- not anyone uses the app then. The rows stay HELD until something changes
-- them, so before checking, any hold at this venue whose expiry has passed is
-- marked Expired; otherwise it would keep blocking both constraints above. The
-- expired rows are locked by that UPDATE, before the venue lock below. Today
-- nothing takes the venue lock and then writes booking rows, so the two can't
-- deadlock; SCRUM-161, which will flag bookings under that lock, has to keep
-- this order in mind (ADR 0010, 2026-10-08 addendum).
-- Timestamps are stored as UTC without a time zone, hence the AT TIME ZONE.
CREATE OR REPLACE FUNCTION booking_overlaps_unavailability() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- SCRUM-163 AC4 and AC8: a hold whose expiry has passed can't be confirmed,
  -- even if nothing has marked it Expired yet. Confirming at the expiry
  -- instant counts as too late, as the expiry is when it stops reserving.
  IF TG_OP = 'UPDATE' AND OLD."status" = 'HELD' AND NEW."status" = 'APPROVED'
     AND OLD."holdExpiresAt" <= now() AT TIME ZONE 'UTC' THEN
    RAISE EXCEPTION
      'new row for relation "Booking" violates check constraint "booking_hold_expired"'
      USING ERRCODE = 'check_violation',
            CONSTRAINT = 'booking_hold_expired';
  END IF;

  UPDATE "Booking"
     SET "status" = 'EXPIRED', "updatedAt" = now() AT TIME ZONE 'UTC'
   WHERE "venueId" = NEW."venueId"
     AND "id" <> NEW."id"
     AND "status" = 'HELD'
     AND "holdExpiresAt" <= now() AT TIME ZONE 'UTC';

  IF NEW."status" IN ('APPROVED', 'HELD') THEN
    -- Take turns with any other write that makes this venue unavailable (see
    -- 20260928090000_venue_occupancy_guard).
    PERFORM 1 FROM "Venue" WHERE "id" = NEW."venueId" FOR NO KEY UPDATE;

    IF EXISTS (
      SELECT 1 FROM "VenueUnavailability" u
       WHERE u."venueId" = NEW."venueId"
         AND tsrange(u."startAt", u."endAt", '[)')
             && booking_occupied_period(NEW."startAt", NEW."endAt",
                                        NEW."setupMinutes", NEW."turnaroundMinutes")
    ) THEN
      RAISE EXCEPTION
        'conflicting key value violates exclusion constraint "booking_overlaps_unavailability"'
        USING ERRCODE = 'exclusion_violation',
              CONSTRAINT = 'booking_overlaps_unavailability';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Pending requests run it too, so an expired hold doesn't block the event from
-- asking for the same venue again (SCRUM-162 AC2).
CREATE TRIGGER booking_overlaps_unavailability
  BEFORE INSERT OR UPDATE OF "status", "startAt", "endAt", "venueId",
                             "setupMinutes", "turnaroundMinutes"
  ON "Booking"
  FOR EACH ROW
  WHEN (NEW."status" IN ('PENDING', 'HELD', 'APPROVED'))
  EXECUTE FUNCTION booking_overlaps_unavailability();

-- Unavailability may overlap bookings (SCRUM-161 AC1: the affected bookings
-- are flagged, not refused) but not other unavailability. The venue lock
-- stays, so an approval and an unavailability record for one venue still take
-- turns and each sees the other (SCRUM-161 AC7).
CREATE OR REPLACE FUNCTION unavailability_overlaps_occupancy() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM "Venue" WHERE "id" = NEW."venueId" FOR NO KEY UPDATE;

  IF EXISTS (
    SELECT 1 FROM "VenueUnavailability" u
     WHERE u."venueId" = NEW."venueId"
       AND u."id" <> NEW."id"
       AND tsrange(u."startAt", u."endAt", '[)')
           && tsrange(NEW."startAt", NEW."endAt", '[)')
  ) THEN
    RAISE EXCEPTION
      'conflicting key value violates exclusion constraint "unavailability_overlaps_unavailability"'
      USING ERRCODE = 'exclusion_violation',
            CONSTRAINT = 'unavailability_overlaps_unavailability';
  END IF;

  RETURN NEW;
END;
$$;
