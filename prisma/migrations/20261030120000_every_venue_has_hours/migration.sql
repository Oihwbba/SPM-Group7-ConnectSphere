-- SCRUM-253 — every venue has opening hours for each day of the week.
-- Creating or editing a venue already requires all seven (SCRUM-34 AC3);
-- 20261015120000_venue_opening_hours left venues whose free-text hours it
-- couldn't read with none.

-- AC1: a venue with no hours gets 00:00–23:59 every day, the widest hours the
-- venue form can show and save. That refuses no booking, as before: an
-- event ends on its start date by 23:59 (SCRUM-190). Venue Staff then set
-- its real hours.
INSERT INTO "VenueOpeningHours" ("id", "venueId", "weekday", "opensMinute", "closesMinute")
SELECT 'voh_' || v."id" || '_' || d."weekday", v."id", d."weekday", 0, 1439
  FROM "Venue" v
 CROSS JOIN generate_series(1, 7) AS d("weekday")
 WHERE NOT EXISTS (SELECT 1 FROM "VenueOpeningHours" h WHERE h."venueId" = v."id");

-- A venue with only some days (no screen writes that) gets the rest as
-- Closed, which is how a missing day already reads (SCRUM-34 AC7), so AC2's
-- rule holds for every existing venue.
INSERT INTO "VenueOpeningHours" ("id", "venueId", "weekday", "opensMinute", "closesMinute")
SELECT 'voh_' || v."id" || '_' || d."weekday", v."id", d."weekday", NULL, NULL
  FROM "Venue" v
 CROSS JOIN generate_series(1, 7) AS d("weekday")
 WHERE NOT EXISTS (
         SELECT 1 FROM "VenueOpeningHours" h
          WHERE h."venueId" = v."id" AND h."weekday" = d."weekday"
       );

-- AC2: checked when the transaction commits, so a venue and its hours can be
-- written in one transaction in either order, and editing hours may replace
-- rows. The unique (venueId, weekday) index and venue_opening_hours_weekday
-- make seven rows exactly Monday to Sunday. A venue deleted in the same
-- transaction (test clean-up; the app retires venues) is not checked.
CREATE FUNCTION venue_has_week_of_hours() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  venue TEXT;
BEGIN
  IF TG_TABLE_NAME = 'Venue' THEN
    venue := NEW."id";
  ELSE
    venue := OLD."venueId";
  END IF;
  IF EXISTS (SELECT 1 FROM "Venue" WHERE "id" = venue)
     AND (SELECT count(*) FROM "VenueOpeningHours" WHERE "venueId" = venue) <> 7 THEN
    RAISE EXCEPTION
      'new row for relation "Venue" violates check constraint "venue_has_week_of_hours"'
      USING ERRCODE = 'check_violation',
            CONSTRAINT = 'venue_has_week_of_hours';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER venue_has_week_of_hours
  AFTER INSERT ON "Venue"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION venue_has_week_of_hours();

CREATE CONSTRAINT TRIGGER venue_opening_hours_keep_week
  AFTER DELETE OR UPDATE OF "venueId", "weekday" ON "VenueOpeningHours"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION venue_has_week_of_hours();
