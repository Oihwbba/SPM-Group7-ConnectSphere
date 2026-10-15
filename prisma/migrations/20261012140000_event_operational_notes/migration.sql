-- SCRUM-25 AC6 — operational notes on an event: who wrote what, and when.
-- Notes are kept as written: they can't be edited or deleted.

CREATE TABLE "EventOperationalNote" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventOperationalNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventOperationalNote_eventId_idx" ON "EventOperationalNote"("eventId");
CREATE INDEX "EventOperationalNote_authorId_idx" ON "EventOperationalNote"("authorId");

ALTER TABLE "EventOperationalNote" ADD CONSTRAINT "EventOperationalNote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventOperationalNote" ADD CONSTRAINT "EventOperationalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EventOperationalNote" ADD CONSTRAINT "event_operational_note_not_blank"
  CHECK (btrim("body") <> '');

-- AC6: a note can't be edited or deleted. Removing its whole event (only
-- test clean-up does that) still takes its notes with it: by the time the
-- cascade reaches a note, its event row is already gone.
CREATE FUNCTION event_operational_note_is_permanent() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND NOT EXISTS (SELECT 1 FROM "Event" WHERE "id" = OLD."eventId") THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'operational notes cannot be edited or deleted'
    USING ERRCODE = 'check_violation',
          CONSTRAINT = 'event_operational_note_permanent';
END;
$$;

CREATE TRIGGER event_operational_note_permanent
  BEFORE UPDATE OR DELETE ON "EventOperationalNote"
  FOR EACH ROW EXECUTE FUNCTION event_operational_note_is_permanent();
