-- SCRUM-142 AC1: a line the Coordinator removes from an equipment request is
-- kept and marked removed, as the project keeps every lifecycle change rather
-- than deleting rows. Adding the type again brings the same row back, so the
-- one-line-per-type unique index is unchanged. Existing lines are all live.
ALTER TABLE "EquipmentRequestLine" ADD COLUMN "removedAt" TIMESTAMP(3);
