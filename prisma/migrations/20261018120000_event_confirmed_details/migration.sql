-- SCRUM-85: what Attendees were last told when the event was Confirmed.
ALTER TABLE "Event" ADD COLUMN "confirmedStartAt" TIMESTAMP(3),
ADD COLUMN "confirmedEndAt" TIMESTAMP(3),
ADD COLUMN "confirmedVenues" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Events already Confirmed were last confirmed as they stand now.
UPDATE "Event" e
SET "confirmedStartAt" = e."startAt",
    "confirmedEndAt" = e."endAt",
    "confirmedVenues" = COALESCE(
      (SELECT array_agg(v."name" || ' — ' || v."location" ORDER BY b."createdAt")
       FROM "Booking" b JOIN "Venue" v ON v."id" = b."venueId"
       WHERE b."eventId" = e."id" AND b."status" = 'APPROVED'),
      ARRAY[]::TEXT[])
WHERE e."status" = 'CONFIRMED';
