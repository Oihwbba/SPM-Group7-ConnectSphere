import { z } from "zod";

/** SCRUM-48 AC2 — the notification being opened. */
export const markNotificationReadSchema = z.object({
  id: z.string().min(1, "Choose a notification."),
});

export type MarkNotificationReadInput = z.input<
  typeof markNotificationReadSchema
>;
