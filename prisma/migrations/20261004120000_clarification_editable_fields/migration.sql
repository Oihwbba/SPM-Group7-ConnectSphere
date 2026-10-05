-- SCRUM-108 AC1: a Coordinator's clarification request names the request-form
-- fields the Organiser may change in the answer. Existing requests named none,
-- so they stay text-only answers.
ALTER TABLE "ClarificationRequest"
  ADD COLUMN "editableFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
