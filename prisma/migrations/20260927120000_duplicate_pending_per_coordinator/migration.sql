-- SCRUM-50 AC6: "Given the Coordinator already has a pending request for the
-- same venue and an overlapping period, when they submit again, then no second
-- request is created and they are shown the existing one."
--
-- The criterion names the Coordinator, the venue and the period, not the
-- event. The original constraint was keyed on the event, so the same
-- Coordinator could hold two overlapping pending requests for one venue by
-- asking under two different events. It is re-keyed on the requesting
-- Coordinator; the name is kept, so application code that recognises the
-- constraint is unchanged.
--
-- Pending requests from DIFFERENT Coordinators may still overlap freely:
-- Venue Staff choose between them (SCRUM-50/53).
ALTER TABLE "Booking" DROP CONSTRAINT "booking_no_duplicate_pending_request";

ALTER TABLE "Booking" ADD CONSTRAINT "booking_no_duplicate_pending_request"
  EXCLUDE USING gist (
    "venueId" WITH =,
    "requestedById" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
  ) WHERE ("status" = 'PENDING');
