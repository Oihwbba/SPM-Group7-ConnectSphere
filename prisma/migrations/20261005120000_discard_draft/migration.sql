-- SCRUM-130 AC1: "Given a Draft I created, when I choose Discard and confirm,
-- then it no longer appears in My Event Requests and cannot be reopened."
--
-- A discarded Draft keeps its row (state changes are never hard deletes) and
-- is marked with when it was discarded. It is a column, not a tenth status,
-- because SCRUM-23 fixes the status list at nine.
ALTER TABLE "Event" ADD COLUMN "discardedAt" TIMESTAMP(3);

-- AC3: only a Draft can be discarded, and a discarded Draft stays a Draft, so
-- it cannot be submitted even by an action that forgets to check.
ALTER TABLE "Event" ADD CONSTRAINT "event_discarded_only_draft"
  CHECK ("discardedAt" IS NULL OR "status" = 'DRAFT');
