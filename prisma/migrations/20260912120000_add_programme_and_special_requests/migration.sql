-- AlterTable: Add programme and specialRequests optional columns if not already present
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "programme" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "specialRequests" TEXT;
