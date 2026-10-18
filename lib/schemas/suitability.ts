import { z } from "zod";

export const JUDGEMENT_NOTE_REQUIRED = "Add a note explaining your judgement.";

/**
 * SCRUM-40 AC8 — the assigned Coordinator's judgement of a venue for their
 * event: Suitable or Not suitable, with a note.
 */
export const suitabilityJudgementSchema = z.object({
  eventId: z.string().min(1, "Choose the event."),
  venueId: z.string().min(1, "Choose the venue."),
  suitable: z.boolean({
    required_error: "Choose Suitable or Not suitable.",
    invalid_type_error: "Choose Suitable or Not suitable.",
  }),
  note: z
    .string({ required_error: JUDGEMENT_NOTE_REQUIRED })
    .trim()
    .min(1, JUDGEMENT_NOTE_REQUIRED)
    .max(1000),
});

export type SuitabilityJudgementInput = z.input<
  typeof suitabilityJudgementSchema
>;
