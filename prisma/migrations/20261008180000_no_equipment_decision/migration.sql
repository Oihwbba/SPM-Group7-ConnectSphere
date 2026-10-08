-- SCRUM-172 AC8, as reworded on 2026-10-08: the event records the
-- Coordinator's "No equipment needed" decision, with who recorded it and when
-- (SCRUM-170 AC4).
--
-- It replaces the per-type equipment quantities 20261008120000 added for
-- SCRUM-127, which was dropped the same day: the Organiser's equipment answer
-- stays free text. That migration is already applied to the shared database,
-- so this one corrects it rather than editing it. The table never held data:
-- nothing in the application writes to it.

DROP TABLE "EventEquipmentNeed";

ALTER TABLE "Event" ADD COLUMN "noEquipmentNeededAt" TIMESTAMP(3),
ADD COLUMN "noEquipmentNeededById" TEXT;

ALTER TABLE "Event" ADD CONSTRAINT "Event_noEquipmentNeededById_fkey"
  FOREIGN KEY ("noEquipmentNeededById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- SCRUM-170 AC4: recording the decision keeps who and when; clearing it (the
-- equipment requirements changed) clears both.
ALTER TABLE "Event" ADD CONSTRAINT "event_no_equipment_decision_complete"
  CHECK (("noEquipmentNeededAt" IS NULL) = ("noEquipmentNeededById" IS NULL));
