-- SCRUM-41 AC1: a change request either changes event fields or asks for the
-- event to be cancelled. A cancellation request carries the Organiser's
-- reason, which SCRUM-128 AC8 uses when it is approved.
ALTER TABLE "EventChangeRequest" ADD COLUMN "requestsCancellation" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "EventChangeRequest" ADD CONSTRAINT "event_change_request_cancellation_has_reason"
  CHECK (NOT "requestsCancellation" OR ("reason" IS NOT NULL AND btrim("reason") <> ''));

-- SCRUM-41 AC7: an event has at most one Submitted change request. The action
-- checks under a lock on the event row; this index is the backstop.
CREATE UNIQUE INDEX "event_change_request_one_submitted"
  ON "EventChangeRequest" ("eventId") WHERE "status" = 'PENDING_REVIEW';
