import { z } from "zod";

import { isValidPeriod } from "@/lib/period";
import { INVALID_PERIOD_MESSAGE } from "@/lib/schemas/booking";

/**
 * SCRUM-161 AC1 — the reasons a venue can be unavailable other than a
 * booking: the database's VenueUnavailabilityReason (SCRUM-172).
 */
export const UNAVAILABILITY_REASONS = [
  "MAINTENANCE",
  "EQUIPMENT_FAILURE",
  "RENOVATION",
  "SAFETY_CONCERN",
  "OTHER",
] as const;

export type UnavailabilityReasonValue = (typeof UNAVAILABILITY_REASONS)[number];

/** How each reason reads on the form, the calendar and in a clash message. */
export const UNAVAILABILITY_REASON_LABEL: Record<
  UnavailabilityReasonValue,
  string
> = {
  MAINTENANCE: "Maintenance",
  EQUIPMENT_FAILURE: "Equipment failure",
  RENOVATION: "Renovation",
  SAFETY_CONCERN: "Safety concern",
  OTHER: "Other",
};

/**
 * SCRUM-37 AC1, SCRUM-161 AC1 — Venue Staff record that a venue is
 * unavailable, with a period, a reason and an optional note.
 *
 * `startAt`/`endAt` are UTC ISO strings, converted from Singapore wall time
 * by the form, exactly as for a booking request.
 *
 * `confirmedBookingIds` are the affected bookings Venue Staff were shown and
 * confirmed (SCRUM-161 AC2). Empty on the first save; the action answers with
 * the bookings the period affects, and saves only once each one is confirmed.
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
    confirmedBookingIds: z.array(z.string()).max(500).default([]),
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
