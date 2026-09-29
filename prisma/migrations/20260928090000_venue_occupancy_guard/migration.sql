-- SCRUM-37 — a venue can never be both booked and unavailable at the same time.
--
-- `booking_no_double_booking` (an EXCLUDE constraint) stops two approved
-- bookings overlapping, but an EXCLUDE constraint only sees one table, so an
-- approval and a maintenance record written at the same instant could both
-- succeed (ADR 0010, "Consequences"). These triggers close that gap in the
-- database, so the guarantee holds however a row is written.
--
-- How: every write that makes a venue unavailable (approving a booking,
-- recording unavailability) first locks that venue's row, then checks the
-- other table. Two such writes for one venue therefore take turns, and the
-- second sees the first once it has committed. `FOR NO KEY UPDATE` is the
-- weakest lock that makes them take turns; ordinary inserts that merely
-- reference the venue (a pending request) are not blocked by it.
--
-- Overlap uses the same half-open `[)` ranges as the EXCLUDE constraint and
-- lib/period.ts: touching at an endpoint is not an overlap.
--
-- A refusal is raised as an exclusion violation (SQLSTATE 23P01) naming the
-- rule, exactly like the constraint, so the application reports it the same
-- way.

CREATE FUNCTION booking_overlaps_unavailability() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM "Venue" WHERE "id" = NEW."venueId" FOR NO KEY UPDATE;

  IF EXISTS (
    SELECT 1 FROM "VenueUnavailability" u
     WHERE u."venueId" = NEW."venueId"
       AND tsrange(u."startAt", u."endAt", '[)')
           && tsrange(NEW."startAt", NEW."endAt", '[)')
  ) THEN
    RAISE EXCEPTION
      'conflicting key value violates exclusion constraint "booking_overlaps_unavailability"'
      USING ERRCODE = 'exclusion_violation',
            CONSTRAINT = 'booking_overlaps_unavailability';
  END IF;

  RETURN NEW;
END;
$$;

-- Only an APPROVED booking makes a venue unavailable; pending requests block
-- nobody (SCRUM-50/53).
CREATE TRIGGER booking_overlaps_unavailability
  BEFORE INSERT OR UPDATE OF "status", "startAt", "endAt", "venueId"
  ON "Booking"
  FOR EACH ROW
  WHEN (NEW."status" = 'APPROVED')
  EXECUTE FUNCTION booking_overlaps_unavailability();

CREATE FUNCTION unavailability_overlaps_occupancy() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM "Venue" WHERE "id" = NEW."venueId" FOR NO KEY UPDATE;

  -- SCRUM-37 AC4: never silently overwrite an approved booking.
  IF EXISTS (
    SELECT 1 FROM "Booking" b
     WHERE b."venueId" = NEW."venueId"
       AND b."status" = 'APPROVED'
       AND tsrange(b."startAt", b."endAt", '[)')
           && tsrange(NEW."startAt", NEW."endAt", '[)')
  ) THEN
    RAISE EXCEPTION
      'conflicting key value violates exclusion constraint "unavailability_overlaps_booking"'
      USING ERRCODE = 'exclusion_violation',
            CONSTRAINT = 'unavailability_overlaps_booking';
  END IF;

  -- A period already recorded as unavailable is not recorded twice.
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

CREATE TRIGGER unavailability_overlaps_occupancy
  BEFORE INSERT OR UPDATE OF "startAt", "endAt", "venueId"
  ON "VenueUnavailability"
  FOR EACH ROW
  EXECUTE FUNCTION unavailability_overlaps_occupancy();
