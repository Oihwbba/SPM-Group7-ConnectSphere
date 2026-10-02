-- SCRUM-129: every event is entered and shown in Singapore time.
--
-- AC2: events saved under another timezone keep their stored instants. Only
-- the label changes: startAt/endAt are already UTC (SCRUM-13 AC6), so they
-- are deliberately left untouched and are now read as Singapore time.
UPDATE "Event" SET "timezone" = 'Asia/Singapore'
  WHERE "timezone" IS DISTINCT FROM 'Asia/Singapore';

-- AC1: no event can be stored with any other timezone, or with none.
ALTER TABLE "Event" ALTER COLUMN "timezone" SET NOT NULL;

ALTER TABLE "Event" ADD CONSTRAINT "event_timezone_singapore"
  CHECK ("timezone" = 'Asia/Singapore');
