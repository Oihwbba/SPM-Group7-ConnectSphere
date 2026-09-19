-- AlterTable: Add timezone column to Event table
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'Asia/Singapore';
