-- SCRUM-89 — recovered migration. This was applied to the shared Supabase
-- database on 2026-09-12 but never committed, so CI and new databases lacked two
-- of its columns. Rebuilt from the live column definitions, under its original
-- name so Supabase's migration history matches the repo. The later
-- 20260912120000_add_programme_and_special_requests migration uses IF NOT
-- EXISTS, so it changes nothing after this one.

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "programme" TEXT,
ADD COLUMN "specialRequests" TEXT,
ADD COLUMN "equipmentTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "registrationRequired" BOOLEAN;
