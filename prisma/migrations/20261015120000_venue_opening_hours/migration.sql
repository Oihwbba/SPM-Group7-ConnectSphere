-- SCRUM-34 AC3 — a venue's opening hours as an opening and a closing time for
-- each day of the week in SGT, or Closed that day, so a booking period can be
-- tested against them (AC7) and search can use them (SCRUM-38). The free-text
-- "operatingHours" column stays: the build still serving during a deploy
-- reads it, and it keeps what was recorded.
CREATE TABLE "VenueOpeningHours" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "opensMinute" INTEGER,
    "closesMinute" INTEGER,

    CONSTRAINT "VenueOpeningHours_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VenueOpeningHours_venueId_weekday_key" ON "VenueOpeningHours"("venueId", "weekday");

ALTER TABLE "VenueOpeningHours" ADD CONSTRAINT "VenueOpeningHours_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 1 is Monday, 7 is Sunday (ISO).
ALTER TABLE "VenueOpeningHours" ADD CONSTRAINT "venue_opening_hours_weekday"
  CHECK ("weekday" BETWEEN 1 AND 7);

-- AC3, AC5: Closed (neither time) or open, with the closing time after the
-- opening time on the same day.
ALTER TABLE "VenueOpeningHours" ADD CONSTRAINT "venue_opening_hours_valid"
  CHECK (
    ("opensMinute" IS NULL AND "closesMinute" IS NULL)
    OR (
      "opensMinute" IS NOT NULL AND "closesMinute" IS NOT NULL
      AND "opensMinute" >= 0 AND "closesMinute" <= 1440
      AND "closesMinute" > "opensMinute"
    )
  );

-- Existing venues' hours. Every venue so far was written as
-- "Mon–Sun HH:MM–HH:MM" or "Mon–Fri HH:MM–HH:MM" (the seed, and no screen
-- could enter anything else), so those two forms become rows: the listed days
-- open, the rest Closed. A venue whose text doesn't match keeps no rows, so
-- nothing is refused on hours that were never recorded until Venue Staff
-- enter them.
INSERT INTO "VenueOpeningHours" ("id", "venueId", "weekday", "opensMinute", "closesMinute")
SELECT 'voh_' || v."id" || '_' || d."weekday",
       v."id",
       d."weekday",
       CASE WHEN d."weekday" <= m."lastDay" THEN m."opensMinute" END,
       CASE WHEN d."weekday" <= m."lastDay" THEN m."closesMinute" END
  FROM "Venue" v
 CROSS JOIN LATERAL (
       SELECT CASE r[1] WHEN 'Sun' THEN 7 ELSE 5 END AS "lastDay",
              split_part(r[2], ':', 1)::int * 60 + split_part(r[2], ':', 2)::int AS "opensMinute",
              split_part(r[3], ':', 1)::int * 60 + split_part(r[3], ':', 2)::int AS "closesMinute"
         FROM regexp_match(btrim(v."operatingHours"),
                           '^Mon[–-](Sun|Fri) ([0-2][0-9]:[0-5][0-9])[–-]([0-2][0-9]:[0-5][0-9])$') AS r
       ) m
 CROSS JOIN generate_series(1, 7) AS d("weekday")
 WHERE m."closesMinute" > m."opensMinute" AND m."closesMinute" <= 1440;
