-- SCRUM-89 — recovered migration. This was applied to the shared Supabase
-- database on 2026-09-12 but never committed, so CI and new databases lacked two
-- of its columns. Rebuilt from the live column definitions, under its original
-- name so Supabase's migration history matches the repo. IF NOT EXISTS keeps it
-- safe on local databases that already ran
-- 20260912120000_add_programme_and_special_requests, which added two of these
-- columns and also uses IF NOT EXISTS.

-- AlterTable
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "programme" TEXT,
ADD COLUMN IF NOT EXISTS "specialRequests" TEXT,
ADD COLUMN IF NOT EXISTS "equipmentTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "registrationRequired" BOOLEAN;
