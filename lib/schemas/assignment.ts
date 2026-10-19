import { z } from "zod";

/** SCRUM-165 — assigning needs only the request and the chosen Coordinator;
 * the Lead comes from the session, never from client input. */
export const assignCoordinatorSchema = z.object({
  eventId: z.string().min(1, "Missing request."),
  coordinatorId: z.string().min(1, "Choose a Coordinator."),
});
