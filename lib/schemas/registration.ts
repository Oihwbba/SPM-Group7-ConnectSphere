import { z } from "zod";

/** SCRUM-73 — registering only ever needs the event id; the Attendee comes
 * from the session, never from client input. */
export const registerForEventSchema = z.object({
  eventId: z.string().min(1, "Missing event."),
});
