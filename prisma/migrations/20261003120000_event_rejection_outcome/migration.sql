-- SCRUM-126: a Coordinator who rejects a request also chooses what the
-- Organiser may do next: amend this request and resubmit it, or start a new one.
CREATE TYPE "RejectionOutcome" AS ENUM ('AMEND_AND_RESUBMIT', 'NEW_REQUEST');

ALTER TABLE "Event" ADD COLUMN "rejectionOutcome" "RejectionOutcome";

-- AC7: rejections recorded before this story are treated as Amend and resubmit,
-- which is what the Sprint 1 code offered on every rejected request.
UPDATE "Event" SET "rejectionOutcome" = 'AMEND_AND_RESUBMIT'
  WHERE "status" = 'REJECTED';

-- AC1: the outcome is chosen with every rejection, as the reason is
-- (event_rejection_has_reason).
ALTER TABLE "Event" ADD CONSTRAINT "event_rejection_has_outcome"
  CHECK ("status" <> 'REJECTED' OR "rejectionOutcome" IS NOT NULL);
