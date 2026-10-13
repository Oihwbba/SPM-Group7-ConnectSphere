import { z } from "zod";

/**
 * SCRUM-159 AC1 — the largest setup or turnaround time, in minutes (one
 * day). The database's `venue_setup_turnaround_range` and
 * `booking_setup_turnaround_range` checks use the same bound, and
 * lib/venue-availability.ts relies on it to know how far around a period an
 * occupied period can reach.
 */
export const MAX_SETUP_TURNAROUND_MINUTES = 1440;

function wholeMinutes(label: string) {
  const message = `${label} must be a whole number of minutes from 0 to 1,440.`;
  return z.preprocess(
    (val) =>
      val === "" || val === null || val === undefined ? undefined : Number(val),
    z
      .number({ required_error: message, invalid_type_error: message })
      .int(message)
      .min(0, message)
      .max(MAX_SETUP_TURNAROUND_MINUTES, message),
  );
}

/**
 * SCRUM-159 AC1 — a venue's setup and turnaround time, as Venue Staff enter
 * them when editing the venue (the form is SCRUM-34's). Each error is
 * reported against its own field.
 */
export const venueTimesSchema = z.object({
  setupMinutes: wholeMinutes("Setup time"),
  turnaroundMinutes: wholeMinutes("Turnaround time"),
});

export type VenueTimes = z.infer<typeof venueTimesSchema>;

/**
 * SCRUM-160 AC1 — saving a venue's times. `confirmed` is false until Venue
 * Staff have seen the bookings the change would make clash and confirmed it.
 */
export const venueTimesChangeSchema = venueTimesSchema.extend({
  venueId: z.string().min(1),
  confirmed: z.boolean().default(false),
});
