-- SCRUM-50 AC8 (re-synced 2026-10-04): "Each event has one venue. Given the
-- event already has a Pending or Approved booking, for any venue, when I
-- submit another, then no request is created and I'm shown the existing one."
--
-- The rule it replaces was keyed on the requesting Coordinator, the venue and
-- an overlapping period (20260927120000_duplicate_pending_per_coordinator), so
-- one event could hold requests for two venues. It is now keyed on the event,
-- over both Pending and Approved bookings. Rejected and Cancelled bookings do
-- not count, so asking again after one creates a new booking (AC9).
--
-- An EXCLUDE constraint rather than a unique index, so a refusal is reported
-- as SQLSTATE 23P01 like the other booking guarantees (lib/db-errors.ts).
ALTER TABLE "Booking" DROP CONSTRAINT "booking_no_duplicate_pending_request";

-- Rows written under the old rule may give one event more than one live
-- booking. Keep one per event (an approved booking before a pending one, then
-- the earliest made) and cancel the rest, so the constraint can be added.
UPDATE "Booking" SET "status" = 'CANCELLED'
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", row_number() OVER (
      PARTITION BY "eventId"
      ORDER BY ("status" = 'APPROVED') DESC, "createdAt", "id"
    ) AS "rank"
    FROM "Booking"
    WHERE "status" IN ('PENDING', 'APPROVED')
  ) AS "ranked"
  WHERE "rank" > 1
);

ALTER TABLE "Booking" ADD CONSTRAINT "booking_one_venue_per_event"
  EXCLUDE USING gist ("eventId" WITH =)
  WHERE ("status" IN ('PENDING', 'APPROVED'));
