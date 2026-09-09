-- Give every `String[]` column a database-level empty-array default.
--
-- WHY THIS EXISTS
--
-- The columns are `TEXT[] NOT NULL` with no default. Prisma omits a scalar
-- list from the INSERT when the caller does not supply one, so Postgres was
-- inserting NULL and rejecting the row:
--
--     Null constraint violation on the (not available)
--     Invalid `prisma.event.create()` invocation
--
-- That broke `createDraftEvent` (the SCRUM-15 reference feature) for every
-- caller that did not pass `requiredFacilities` explicitly, and the same trap
-- was waiting for Venue and Booking inserts. The seed never hit it only
-- because it happens to pass every array by hand.
--
-- The previous migration deliberately dropped these defaults, reasoning that
-- Prisma models `String[]` without one. The schema now declares `@default([])`
-- on each of these fields, so Prisma and the database agree and `prisma
-- migrate` reports no drift.
--
-- Fixing forward with a new migration rather than editing
-- 20260909120000_full_domain_model, which is already applied on main.

ALTER TABLE "Event"   ALTER COLUMN "requiredFacilities"    SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Booking" ALTER COLUMN "requiredFacilities"    SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Venue"   ALTER COLUMN "facilities"            SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Venue"   ALTER COLUMN "accessibilityFeatures" SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Venue"   ALTER COLUMN "supportedLayouts"      SET DEFAULT ARRAY[]::TEXT[];
