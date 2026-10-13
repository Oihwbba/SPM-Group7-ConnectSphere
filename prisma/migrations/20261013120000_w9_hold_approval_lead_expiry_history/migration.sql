-- SCRUM-172 AC12 to AC14 — the data the Week 9 clarifications need, added to
-- the Week 7 migration task so the stories that build on it don't write
-- clashing migrations in parallel. Like 20261008120000, it adds columns,
-- tables and rules and changes no behaviour. Every change is additive:
-- existing rows start with none of the new data and meet every new rule.

-- ===========================================================================
-- AC12 — an event records its supervising Lead (SCRUM-165 AC11). Existing
-- events start with none.
-- ===========================================================================

ALTER TABLE "Event" ADD COLUMN "supervisingLeadId" TEXT;

CREATE INDEX "Event_supervisingLeadId_idx" ON "Event"("supervisingLeadId");
ALTER TABLE "Event" ADD CONSTRAINT "Event_supervisingLeadId_fkey"
  FOREIGN KEY ("supervisingLeadId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ===========================================================================
-- AC13 — a venue booking records when, and by whom, Venue Staff approved its
-- hold (SCRUM-163 AC7), which its Coordinator then confirms (AC3). Existing
-- bookings start with none.
-- ===========================================================================

ALTER TABLE "Booking" ADD COLUMN "holdApprovedAt" TIMESTAMP(3),
ADD COLUMN "holdApprovedById" TEXT;

-- RESTRICT, not SET NULL: nulling only who approved would break
-- booking_hold_approval_complete below, so the delete would fail anyway.
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_holdApprovedById_fkey"
  FOREIGN KEY ("holdApprovedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- An approval records both who and when, and only a booking that was held
-- can have one, approved no earlier than the hold was placed. It stays once
-- the hold is confirmed, released, rejected or expires, as its history.
ALTER TABLE "Booking" ADD CONSTRAINT "booking_hold_approval_complete"
  CHECK (("holdApprovedAt" IS NULL) = ("holdApprovedById" IS NULL)
         AND ("holdApprovedAt" IS NULL
              OR ("heldAt" IS NOT NULL AND "holdApprovedAt" >= "heldAt")));

-- SCRUM-124 AC4: the Coordinator is told when Venue Staff approve a hold.
ALTER TYPE "NotificationType" ADD VALUE 'HOLD_APPROVED';

-- ===========================================================================
-- AC14 — each change to a hold's expiry is recorded with the old expiry, the
-- new expiry, who changed it and when.
-- ===========================================================================

CREATE TABLE "HoldExpiryChange" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "oldExpiresAt" TIMESTAMP(3) NOT NULL,
    "newExpiresAt" TIMESTAMP(3) NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HoldExpiryChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HoldExpiryChange_bookingId_idx" ON "HoldExpiryChange"("bookingId");
ALTER TABLE "HoldExpiryChange" ADD CONSTRAINT "HoldExpiryChange_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HoldExpiryChange" ADD CONSTRAINT "HoldExpiryChange_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- A change moves the expiry; recording the same expiry again is no change.
ALTER TABLE "HoldExpiryChange" ADD CONSTRAINT "hold_expiry_change_differs"
  CHECK ("oldExpiresAt" <> "newExpiresAt");
