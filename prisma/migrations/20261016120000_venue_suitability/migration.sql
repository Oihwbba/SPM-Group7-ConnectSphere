-- SCRUM-40 — what suitability is checked against, and the Coordinator's own
-- judgement of a venue for an event.

-- AC3: a booking request names the accessibility features it needs, as tags
-- comparable with the venue's (the Organiser's answer is free text, so it
-- can't be compared; the Coordinator enters these on the request).
ALTER TABLE "Booking" ADD COLUMN "requiredAccessibilityFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AC8: one judgement per event and venue, Suitable or Not suitable, with a
-- note; recording it again replaces it. It counts for that event (AC8) but
-- never blocks anything (AC9).
CREATE TABLE "VenueSuitabilityJudgement" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "suitable" BOOLEAN NOT NULL,
    "note" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueSuitabilityJudgement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VenueSuitabilityJudgement_eventId_venueId_key" ON "VenueSuitabilityJudgement"("eventId", "venueId");
CREATE INDEX "VenueSuitabilityJudgement_venueId_idx" ON "VenueSuitabilityJudgement"("venueId");

ALTER TABLE "VenueSuitabilityJudgement" ADD CONSTRAINT "VenueSuitabilityJudgement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VenueSuitabilityJudgement" ADD CONSTRAINT "VenueSuitabilityJudgement_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VenueSuitabilityJudgement" ADD CONSTRAINT "VenueSuitabilityJudgement_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AC8: the judgement comes with a note.
ALTER TABLE "VenueSuitabilityJudgement" ADD CONSTRAINT "venue_suitability_note_required"
  CHECK (btrim("note") <> '');
