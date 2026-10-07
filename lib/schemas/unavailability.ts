import { z } from "zod";

import { isValidPeriod } from "@/lib/period";
import { INVALID_PERIOD_MESSAGE } from "@/lib/schemas/booking";

/** SCRUM-37 — the reasons a venue can be unavailable other than a booking. */
export const UNAVAILABILITY_REASONS = [
  "MAINTENANCE",
  "DAMAGED",
  "CLOSURE",
  "OTHER",
] as const;

/**
 * SCRUM-37 AC1 — "Venue Staff can record non-booking unavailability
 * directly, with a period and a reason (e.g. maintenance, closure)."
 *
 * `startAt`/`endAt` are UTC ISO strings, converted from Singapore wall time
 * by the form, exactly as for a booking request.
 */
export const recordUnavailabilitySchema = z
  .object({
    venueId: z.string().min(1, "Choose a venue."),
    startAt: z.string().min(1, "Choose a start time."),
    endAt: z.string().min(1, "Choose an end time."),
    reason: z.enum(UNAVAILABILITY_REASONS, {
      errorMap: () => ({ message: "Choose a reason." }),
    }),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    const period = {
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
    };
    if (!isValidPeriod(period)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: INVALID_PERIOD_MESSAGE,
      });
    }
  });

export type RecordUnavailabilityInput = z.input<
  typeof recordUnavailabilitySchema
>;
