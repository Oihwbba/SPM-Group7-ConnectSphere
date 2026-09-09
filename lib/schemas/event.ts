import { z } from "zod";

/**
 * Zod schemas for the Event entity live here, beside the entity, and are
 * imported by BOTH the form and the server action so validation is written
 * once (see the reference implementation in app/(app)/events).
 *
 * This is the foundation's only Event schema. Feature developers add more
 * (submitEventSchema, updateEventSchema, ...) here as they build.
 */
export const createDraftEventSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the event a name.")
    .max(200, "Keep the name under 200 characters."),
  // Optional because a draft is intentionally incomplete — the organiser fills
  // in the rest before submitting for review.
  description: z
    .string()
    .trim()
    .max(5000, "Keep the description under 5000 characters.")
    .optional(),
});

export type CreateDraftEventInput = z.infer<typeof createDraftEventSchema>;
