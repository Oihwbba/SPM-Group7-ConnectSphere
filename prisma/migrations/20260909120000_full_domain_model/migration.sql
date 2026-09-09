-- ConnectSphere — full Release-1 domain model.
--
-- This migration extends the Sprint-1 spine (20260101000000_init) to cover
-- every one of the twenty confirmed Release-1 features. It is ADDITIVE: the
-- init migration is not edited, because it is already on `main` and rewriting
-- applied migration history breaks everyone else's database.
--
-- Two kinds of statement live here:
--   1. Statements Prisma would have generated from prisma/schema.prisma.
--   2. Hand-written CHECK / EXCLUDE / partial-unique constraints that Prisma
--      cannot express. These are the ones that make the acceptance criteria
--      true in the DATABASE rather than only in application code. Each one
--      names the story it satisfies.
--
-- Convention enforced here: two periods that touch at an endpoint DO NOT
-- overlap (SCRUM-29/30/31/36/38/50/53). That is what the half-open `[)`
-- range bound means below.
--
-- All DateTime columns are `timestamp(3)` (no time zone) holding UTC, per the
-- convention at the top of schema.prisma — so ranges use `tsrange`, not
-- `tstzrange`. If those columns are ever migrated to `timestamptz`, these
-- constraints must move to `tstzrange` in the same migration.

-- ===========================================================================
-- 1. New enums
-- ===========================================================================

CREATE TYPE "ClarificationStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

CREATE TYPE "EquipmentRequestStatus" AS ENUM ('PENDING_REVIEW', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TYPE "ReservationStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

CREATE TYPE "UnavailabilityReason" AS ENUM ('MAINTENANCE', 'DAMAGED', 'CLOSURE', 'OTHER');

CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

CREATE TYPE "NotificationType" AS ENUM (
  'EVENT_STATUS_CHANGED',
  'COORDINATOR_ASSIGNED',
  'COORDINATOR_REASSIGNED',
  'CLARIFICATION_REQUESTED',
  'BOOKING_DECISION',
  'EQUIPMENT_REQUEST_UPDATED',
  'RESERVATION_CANCELLED',
  'CHANGE_REQUEST_OUTCOME',
  'REGISTRATION_CONFIRMED',
  'REGISTERED_EVENT_CHANGED',
  'REGISTERED_EVENT_CANCELLED'
);

-- ===========================================================================
-- 2. Event — SCRUM-13 form fields, SCRUM-14/19/82/83 lifecycle timestamps
-- ===========================================================================

ALTER TABLE "Event"
  ADD COLUMN "purpose"               TEXT,
  ADD COLUMN "venueRequirements"     TEXT,
  ADD COLUMN "requiredFacilities"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "accessibilityNeeds"    TEXT,
  ADD COLUMN "preferredLayout"       TEXT,
  ADD COLUMN "equipmentRequirements" TEXT,
  ADD COLUMN "registrationNotes"     TEXT,
  ADD COLUMN "submittedAt"           TIMESTAMP(3),
  ADD COLUMN "decidedAt"             TIMESTAMP(3),
  ADD COLUMN "decidedById"           TEXT,
  ADD COLUMN "decisionReason"        TEXT,
  ADD COLUMN "cancelledAt"           TIMESTAMP(3),
  ADD COLUMN "cancelledById"         TEXT,
  ADD COLUMN "cancellationReason"    TEXT,
  ADD COLUMN "completedAt"           TIMESTAMP(3);

-- Prisma models `String[]` with no database-level default, so drop the
-- default that made the ADD COLUMN safe on a table that already has rows.
ALTER TABLE "Event" ALTER COLUMN "requiredFacilities" DROP DEFAULT;

-- ===========================================================================
-- 3. Venue — SCRUM-34 (accessibility, layouts, operating info), SCRUM-35
-- ===========================================================================

ALTER TABLE "Venue"
  ADD COLUMN "accessibilityFeatures" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "supportedLayouts"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "operatingHours"        TEXT,
  ADD COLUMN "notes"                 TEXT,
  ADD COLUMN "isActive"              BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Venue" ALTER COLUMN "accessibilityFeatures" DROP DEFAULT;
ALTER TABLE "Venue" ALTER COLUMN "supportedLayouts" DROP DEFAULT;

-- ===========================================================================
-- 4. Booking — SCRUM-50 request payload, SCRUM-53 decision, SCRUM-44 flag
-- ===========================================================================

ALTER TABLE "Booking"
  ADD COLUMN "requestedAttendance"      INTEGER,
  ADD COLUMN "requiredFacilities"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "requestedLayout"          TEXT,
  ADD COLUMN "requestNotes"             TEXT,
  ADD COLUMN "requestedById"            TEXT,
  ADD COLUMN "decidedById"              TEXT,
  ADD COLUMN "decidedAt"                TIMESTAMP(3),
  ADD COLUMN "decisionReason"           TEXT,
  ADD COLUMN "needsReconsideration"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reconsiderationFlaggedAt" TIMESTAMP(3);

ALTER TABLE "Booking" ALTER COLUMN "requiredFacilities" DROP DEFAULT;

-- Backfill before enforcing NOT NULL, so this migration is safe on a database
-- that already has Sprint-1 rows rather than only on a freshly reset one.
UPDATE "Booking" b
   SET "requestedById" = COALESCE(e."coordinatorId", e."organiserId")
  FROM "Event" e
 WHERE e."id" = b."eventId"
   AND b."requestedById" IS NULL;

ALTER TABLE "Booking" ALTER COLUMN "requestedById" SET NOT NULL;

-- ===========================================================================
-- 5. Equipment — SCRUM-27 predefined list, SCRUM-28 specs
-- ===========================================================================

ALTER TABLE "Equipment"
  ADD COLUMN "description"    TEXT,
  ADD COLUMN "technicalSpecs" TEXT,
  ADD COLUMN "isActive"       BOOLEAN NOT NULL DEFAULT true;

-- SCRUM-27: "select the equipment type from a predefined system list" — the
-- list is only well defined if a type appears once.
CREATE UNIQUE INDEX "Equipment_type_key" ON "Equipment"("type");

-- ===========================================================================
-- 6. Reservation — SCRUM-31/32 status and ownership, SCRUM-44 flag
-- ===========================================================================

ALTER TABLE "Reservation"
  ADD COLUMN "requestId"                TEXT,
  ADD COLUMN "status"                   "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
  ADD COLUMN "cancelledAt"              TIMESTAMP(3),
  ADD COLUMN "reservedById"             TEXT,
  ADD COLUMN "needsReconsideration"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reconsiderationFlaggedAt" TIMESTAMP(3);

UPDATE "Reservation" r
   SET "reservedById" = COALESCE(e."coordinatorId", e."organiserId")
  FROM "Event" e
 WHERE e."id" = r."eventId"
   AND r."reservedById" IS NULL;

ALTER TABLE "Reservation" ALTER COLUMN "reservedById" SET NOT NULL;

-- ===========================================================================
-- 7. Registration — SCRUM-77 withdrawal, SCRUM-44 flag
-- ===========================================================================

ALTER TABLE "Registration"
  ADD COLUMN "registeredAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "withdrawnAt"              TIMESTAMP(3),
  ADD COLUMN "needsReconsideration"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reconsiderationFlaggedAt" TIMESTAMP(3);

-- ===========================================================================
-- 8. Notification — SCRUM-45/48; `type` becomes a closed enum so every
--    notification in the system has a named, traceable trigger.
-- ===========================================================================

ALTER TABLE "Notification"
  ADD COLUMN "title"   TEXT NOT NULL DEFAULT '',
  ADD COLUMN "eventId" TEXT;

ALTER TABLE "Notification" ALTER COLUMN "title" DROP DEFAULT;

-- Any pre-existing free-text type values are mapped to the closest enum
-- member; there is no notification-producing feature yet, so in practice this
-- table is empty.
UPDATE "Notification"
   SET "type" = 'EVENT_STATUS_CHANGED'
 WHERE "type" NOT IN (
   'EVENT_STATUS_CHANGED','COORDINATOR_ASSIGNED','COORDINATOR_REASSIGNED',
   'CLARIFICATION_REQUESTED','BOOKING_DECISION','EQUIPMENT_REQUEST_UPDATED',
   'RESERVATION_CANCELLED','CHANGE_REQUEST_OUTCOME','REGISTRATION_CONFIRMED',
   'REGISTERED_EVENT_CHANGED','REGISTERED_EVENT_CANCELLED'
 );

ALTER TABLE "Notification"
  ALTER COLUMN "type" TYPE "NotificationType" USING "type"::"NotificationType";

DROP INDEX IF EXISTS "Notification_userId_idx";

-- ===========================================================================
-- 9. New tables
-- ===========================================================================

-- SCRUM-18 — the clarification loop. Deliberately NOT a tenth EventStatus:
-- SCRUM-23 fixes the status list at nine values.
CREATE TABLE "ClarificationRequest" (
    "id"            TEXT NOT NULL,
    "eventId"       TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "message"       TEXT NOT NULL,
    "status"        "ClarificationStatus" NOT NULL DEFAULT 'OPEN',
    "response"      TEXT,
    "respondedAt"   TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClarificationRequest_pkey" PRIMARY KEY ("id")
);

-- SCRUM-36/37 — non-booking venue unavailability, recorded by Venue Staff.
CREATE TABLE "VenueUnavailability" (
    "id"           TEXT NOT NULL,
    "venueId"      TEXT NOT NULL,
    "startAt"      TIMESTAMP(3) NOT NULL,
    "endAt"        TIMESTAMP(3) NOT NULL,
    "reason"       "UnavailabilityReason" NOT NULL DEFAULT 'MAINTENANCE',
    "note"         TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueUnavailability_pkey" PRIMARY KEY ("id")
);

-- SCRUM-29/30 — "Under Maintenance" / "Damaged". Carries a quantity because
-- the pool is partially removable.
CREATE TABLE "EquipmentUnavailability" (
    "id"           TEXT NOT NULL,
    "equipmentId"  TEXT NOT NULL,
    "quantity"     INTEGER NOT NULL,
    "startAt"      TIMESTAMP(3) NOT NULL,
    "endAt"        TIMESTAMP(3) NOT NULL,
    "reason"       "UnavailabilityReason" NOT NULL DEFAULT 'MAINTENANCE',
    "note"         TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentUnavailability_pkey" PRIMARY KEY ("id")
);

-- SCRUM-27/28 — equipment request header.
CREATE TABLE "EquipmentRequest" (
    "id"            TEXT NOT NULL,
    "eventId"       TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status"        "EquipmentRequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "notes"         TEXT,
    "decidedAt"     TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentRequest_pkey" PRIMARY KEY ("id")
);

-- SCRUM-27 — one line per equipment type; SCRUM-28 — suggested alternative.
CREATE TABLE "EquipmentRequestLine" (
    "id"                     TEXT NOT NULL,
    "requestId"              TEXT NOT NULL,
    "equipmentId"            TEXT NOT NULL,
    "quantity"               INTEGER NOT NULL,
    "technicalRequirements"  TEXT,
    "suggestedAlternativeId" TEXT,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentRequestLine_pkey" PRIMARY KEY ("id")
);

-- SCRUM-28 — "a chronological history log of all updates made". Append-only.
CREATE TABLE "EquipmentRequestUpdate" (
    "id"         TEXT NOT NULL,
    "requestId"  TEXT NOT NULL,
    "actorId"    TEXT NOT NULL,
    "fromStatus" "EquipmentRequestStatus",
    "toStatus"   "EquipmentRequestStatus",
    "note"       TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentRequestUpdate_pkey" PRIMARY KEY ("id")
);

-- SCRUM-41/42/43 — change request header.
CREATE TABLE "EventChangeRequest" (
    "id"             TEXT NOT NULL,
    "eventId"        TEXT NOT NULL,
    "requestedById"  TEXT NOT NULL,
    "status"         "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reason"         TEXT,
    "decidedById"    TEXT,
    "decidedAt"      TIMESTAMP(3),
    "decisionReason" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventChangeRequest_pkey" PRIMARY KEY ("id")
);

-- SCRUM-42 — "both the old value and new requested value are displayed for
-- each changed field". SCRUM-44 — `isMajor` decides what gets flagged.
CREATE TABLE "ChangeRequestField" (
    "id"              TEXT NOT NULL,
    "changeRequestId" TEXT NOT NULL,
    "fieldName"       TEXT NOT NULL,
    "oldValue"        TEXT,
    "newValue"        TEXT,
    "isMajor"         BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ChangeRequestField_pkey" PRIMARY KEY ("id")
);

-- SCRUM-71 — append-only audit trail. No `updatedAt` on purpose: entries
-- "cannot be edited or deleted through the application".
CREATE TABLE "AuditLog" (
    "id"         TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId"   TEXT NOT NULL,
    "action"     TEXT NOT NULL,
    "actorId"    TEXT,
    "fieldName"  TEXT,
    "oldValue"   TEXT,
    "newValue"   TEXT,
    "summary"    TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- ===========================================================================
-- 10. Indexes
-- ===========================================================================

CREATE INDEX "Event_status_idx" ON "Event"("status");

CREATE INDEX "Booking_status_idx" ON "Booking"("status");
CREATE INDEX "Booking_requestedById_idx" ON "Booking"("requestedById");

CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");

CREATE INDEX "Registration_eventId_status_idx" ON "Registration"("eventId", "status");

CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_eventId_idx" ON "Notification"("eventId");

CREATE INDEX "ClarificationRequest_eventId_idx" ON "ClarificationRequest"("eventId");
CREATE INDEX "ClarificationRequest_status_idx" ON "ClarificationRequest"("status");

CREATE INDEX "VenueUnavailability_venueId_idx" ON "VenueUnavailability"("venueId");

CREATE INDEX "EquipmentUnavailability_equipmentId_idx" ON "EquipmentUnavailability"("equipmentId");

CREATE INDEX "EquipmentRequest_eventId_idx" ON "EquipmentRequest"("eventId");
CREATE INDEX "EquipmentRequest_status_idx" ON "EquipmentRequest"("status");

CREATE UNIQUE INDEX "EquipmentRequestLine_requestId_equipmentId_key" ON "EquipmentRequestLine"("requestId", "equipmentId");
CREATE INDEX "EquipmentRequestLine_equipmentId_idx" ON "EquipmentRequestLine"("equipmentId");

CREATE INDEX "EquipmentRequestUpdate_requestId_idx" ON "EquipmentRequestUpdate"("requestId");

CREATE INDEX "EventChangeRequest_eventId_idx" ON "EventChangeRequest"("eventId");
CREATE INDEX "EventChangeRequest_status_idx" ON "EventChangeRequest"("status");

CREATE UNIQUE INDEX "ChangeRequestField_changeRequestId_fieldName_key" ON "ChangeRequestField"("changeRequestId", "fieldName");

CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- ===========================================================================
-- 11. Foreign keys
-- ===========================================================================

ALTER TABLE "Event" ADD CONSTRAINT "Event_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "EquipmentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_reservedById_fkey" FOREIGN KEY ("reservedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClarificationRequest" ADD CONSTRAINT "ClarificationRequest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClarificationRequest" ADD CONSTRAINT "ClarificationRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VenueUnavailability" ADD CONSTRAINT "VenueUnavailability_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VenueUnavailability" ADD CONSTRAINT "VenueUnavailability_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EquipmentUnavailability" ADD CONSTRAINT "EquipmentUnavailability_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EquipmentUnavailability" ADD CONSTRAINT "EquipmentUnavailability_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EquipmentRequest" ADD CONSTRAINT "EquipmentRequest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EquipmentRequest" ADD CONSTRAINT "EquipmentRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EquipmentRequestLine" ADD CONSTRAINT "EquipmentRequestLine_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "EquipmentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EquipmentRequestLine" ADD CONSTRAINT "EquipmentRequestLine_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EquipmentRequestLine" ADD CONSTRAINT "EquipmentRequestLine_suggestedAlternativeId_fkey" FOREIGN KEY ("suggestedAlternativeId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EquipmentRequestUpdate" ADD CONSTRAINT "EquipmentRequestUpdate_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "EquipmentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EquipmentRequestUpdate" ADD CONSTRAINT "EquipmentRequestUpdate_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EventChangeRequest" ADD CONSTRAINT "EventChangeRequest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventChangeRequest" ADD CONSTRAINT "EventChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventChangeRequest" ADD CONSTRAINT "EventChangeRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChangeRequestField" ADD CONSTRAINT "ChangeRequestField_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "EventChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===========================================================================
-- 12. Domain constraints Prisma cannot express
--
-- Everything below this line is the reason the acceptance criteria hold even
-- if a future developer forgets a check in application code. Each constraint
-- names its story.
-- ===========================================================================

-- Required for the EXCLUDE constraints below: btree_gist lets a GiST index
-- mix an equality column ("venueId") with a range column.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- --- Value ranges ----------------------------------------------------------

-- SCRUM-13: "attendance must be a positive whole number".
ALTER TABLE "Event" ADD CONSTRAINT "event_attendance_positive"
  CHECK ("expectedAttendance" IS NULL OR "expectedAttendance" > 0);

-- SCRUM-13: end earlier than or the same as the start is invalid.
ALTER TABLE "Event" ADD CONSTRAINT "event_period_valid"
  CHECK ("startAt" IS NULL OR "endAt" IS NULL OR "endAt" > "startAt");

-- SCRUM-74: "capacity must be a positive whole number".
ALTER TABLE "Event" ADD CONSTRAINT "event_registration_capacity_positive"
  CHECK ("registrationCapacity" IS NULL OR "registrationCapacity" > 0);

-- SCRUM-75: "a registration period whose closing instant is earlier than or
-- the same as its opening instant ... is rejected as an invalid period".
ALTER TABLE "Event" ADD CONSTRAINT "event_registration_period_valid"
  CHECK ("registrationOpensAt" IS NULL OR "registrationClosesAt" IS NULL
         OR "registrationClosesAt" > "registrationOpensAt");

-- SCRUM-35: "capacity must be a positive whole number".
ALTER TABLE "Venue" ADD CONSTRAINT "venue_capacity_positive"
  CHECK ("capacity" > 0);

ALTER TABLE "Booking" ADD CONSTRAINT "booking_period_valid"
  CHECK ("endAt" > "startAt");

ALTER TABLE "Booking" ADD CONSTRAINT "booking_attendance_positive"
  CHECK ("requestedAttendance" IS NULL OR "requestedAttendance" > 0);

ALTER TABLE "VenueUnavailability" ADD CONSTRAINT "venue_unavailability_period_valid"
  CHECK ("endAt" > "startAt");

ALTER TABLE "Equipment" ADD CONSTRAINT "equipment_total_quantity_non_negative"
  CHECK ("totalQuantity" >= 0);

-- SCRUM-29/31/32: "a quantity of zero or a negative number ... is invalid".
ALTER TABLE "EquipmentRequestLine" ADD CONSTRAINT "equipment_request_line_quantity_positive"
  CHECK ("quantity" > 0);

ALTER TABLE "Reservation" ADD CONSTRAINT "reservation_quantity_positive"
  CHECK ("quantity" > 0);

ALTER TABLE "Reservation" ADD CONSTRAINT "reservation_period_valid"
  CHECK ("endAt" > "startAt");

ALTER TABLE "EquipmentUnavailability" ADD CONSTRAINT "equipment_unavailability_quantity_positive"
  CHECK ("quantity" > 0);

ALTER TABLE "EquipmentUnavailability" ADD CONSTRAINT "equipment_unavailability_period_valid"
  CHECK ("endAt" > "startAt");

-- --- Reasons that are required, not optional -------------------------------

-- SCRUM-19: rejecting an event request records a reason.
UPDATE "Event"
   SET "decisionReason" = 'Reason not recorded (pre-constraint data).'
 WHERE "status" = 'REJECTED' AND ("decisionReason" IS NULL OR btrim("decisionReason") = '');

ALTER TABLE "Event" ADD CONSTRAINT "event_rejection_has_reason"
  CHECK ("status" <> 'REJECTED'
         OR ("decisionReason" IS NOT NULL AND btrim("decisionReason") <> ''));

-- SCRUM-53: "a reason/comment is required and the decision cannot be saved
-- without one".
ALTER TABLE "Booking" ADD CONSTRAINT "booking_rejection_has_reason"
  CHECK ("status" <> 'REJECTED'
         OR ("decisionReason" IS NOT NULL AND btrim("decisionReason") <> ''));

-- SCRUM-43: "a reason field is required (cannot submit blank)".
ALTER TABLE "EventChangeRequest" ADD CONSTRAINT "change_request_rejection_has_reason"
  CHECK ("status" <> 'REJECTED'
         OR ("decisionReason" IS NOT NULL AND btrim("decisionReason") <> ''));

-- --- No double-booking -----------------------------------------------------

-- SCRUM-53: "Given two pending requests for the same venue cover overlapping
-- periods, when Venue Staff approve both at the same moment, then only one
-- approval succeeds ... the venue is never double-booked."
--
-- The `[)` bound is the endpoint convention: a booking ending at exactly the
-- moment another begins does NOT conflict (SCRUM-38/50/53).
-- The WHERE clause scopes this to approved bookings, so any number of pending
-- requests may compete for the same slot until one is approved.
ALTER TABLE "Booking" ADD CONSTRAINT "booking_no_double_booking"
  EXCLUDE USING gist (
    "venueId" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
  ) WHERE ("status" = 'APPROVED');

-- SCRUM-50: "Given the Coordinator already has a pending request for the same
-- venue and an overlapping period, when they submit again, then no second
-- request is created."
ALTER TABLE "Booking" ADD CONSTRAINT "booking_no_duplicate_pending_request"
  EXCLUDE USING gist (
    "venueId" WITH =,
    "eventId" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
  ) WHERE ("status" = 'PENDING');

-- --- No duplicate equipment request ----------------------------------------

-- SCRUM-27: "Given this event already has a request pending review, when I
-- submit another, then I am shown the existing request rather than creating a
-- second one for the same event." A partial unique index makes a second open
-- request impossible rather than merely discouraged.
CREATE UNIQUE INDEX "EquipmentRequest_one_open_per_event"
    ON "EquipmentRequest"("eventId")
 WHERE ("status" IN ('PENDING_REVIEW', 'IN_REVIEW'));
