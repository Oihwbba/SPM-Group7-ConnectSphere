-- SCRUM-254 — no event rests in Approved (SCRUM-135 AC12). Approval moves an
-- event straight to Planning (SCRUM-81); an event left Approved from before
-- that change is the only way a row can still say Approved.

-- AC1: such an event makes the move approval makes today, recorded in its
-- history as a system change, as the approve action records it.
INSERT INTO "AuditLog" ("id", "entityType", "entityId", "action", "actorId",
                        "fieldName", "oldValue", "newValue", "summary", "createdAt")
SELECT 'aud_scrum254_' || e."id", 'Event', e."id", 'STATUS_CHANGED', NULL,
       'status', 'APPROVED', 'PLANNING',
       'Moved to Planning: approval now does this in the same action (SCRUM-81, SCRUM-254)',
       now() AT TIME ZONE 'UTC'
  FROM "Event" e
 WHERE e."status" = 'APPROVED';

UPDATE "Event"
   SET "status" = 'PLANNING', "updatedAt" = now() AT TIME ZONE 'UTC'
 WHERE "status" = 'APPROVED';

-- AC2: Approved stays an EventStatus value, as a name in an event's history
-- (SCRUM-135 AC12), but no event is stored with it.
ALTER TABLE "Event" ADD CONSTRAINT "event_never_rests_approved"
  CHECK ("status" <> 'APPROVED');
