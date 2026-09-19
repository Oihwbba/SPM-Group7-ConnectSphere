import { z } from "zod";

/**
 * SCRUM-18 — a Coordinator asks the Organiser for more information.
 */
export const requestClarificationSchema = z.object({
  eventId: z.string().min(1),
  message: z
    .string()
    .trim()
    .min(1, "Say what you need clarified.")
    .max(2000, "Keep the message under 2000 characters."),
});

/**
 * SCRUM-18 — the Organiser's reply to an open clarification request.
 */
export const respondClarificationSchema = z.object({
  clarificationId: z.string().min(1),
  response: z
    .string()
    .trim()
    .min(1, "Enter a response before sending.")
    .max(2000, "Keep the response under 2000 characters."),
});

export type RequestClarificationInput = z.infer<typeof requestClarificationSchema>;
export type RespondClarificationInput = z.infer<typeof respondClarificationSchema>;