import { z } from "zod";

/** SCRUM-73 — registering only ever needs the event id; the Attendee comes
 * from the session, never from client input. */
export const registerForEventSchema = z.object({
  eventId: z.string().min(1, "Missing event."),
});

/** SCRUM-74's withdraw-reopens-capacity slice of SCRUM-77 — only ever needs
 * the registration id; ownership is checked against the session, never
 * trusted from client input. */
export const withdrawRegistrationSchema = z.object({
  registrationId: z.string().min(1, "Missing registration."),
});
