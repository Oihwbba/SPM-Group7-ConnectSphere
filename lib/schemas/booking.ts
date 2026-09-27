import { z } from "zod";

import { isValidPeriod } from "@/lib/period";

export const INVALID_PERIOD_MESSAGE =
  "The requested period is invalid: the end must be after the start.";

/**
 * SCRUM-50 — "Request captures venue, date/time, expected attendance,
 * required facilities/layout, and other relevant event details."
 *
 * `startAt`/`endAt` are UTC ISO strings; the form converts the Singapore wall
 * time the Coordinator typed with lib/datetime.ts before sending them.
 */
export const bookingRequestSchema = z
  .object({
    eventId: z.string().min(1, "Choose the event this venue is for."),
    venueId: z.string().min(1, "Choose a venue."),
    startAt: z.string().min(1, "Choose a start time."),
    endAt: z.string().min(1, "Choose an end time."),
    requestedAttendance: z.coerce
      .number({ invalid_type_error: "Enter the expected attendance." })
      .int("Attendance must be a whole number.")
      .positive("Attendance must be greater than zero."),
    requiredFacilities: z.array(z.string().trim().min(1)).default([]),
    requestedLayout: z.string().trim().max(100).optional(),
    requestNotes: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    const period = {
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
    };
    // SCRUM-50 AC5: an end at or before the start is refused before anything
    // else happens.
    if (!isValidPeriod(period)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: INVALID_PERIOD_MESSAGE,
      });
    }
  });

/**
 * SCRUM-53 — approve, or reject with a free-text reason. A blank or
 * whitespace-only reason is not a reason (customer clarification 2026-09-13).
 */
export const bookingDecisionSchema = z
  .object({
    bookingId: z.string().min(1),
    decision: z.enum(["APPROVED", "REJECTED"]),
    reason: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === "REJECTED" && !data.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "A reason is required to reject a booking request.",
      });
    }
  });

export type BookingRequestInput = z.input<typeof bookingRequestSchema>;
export type BookingDecisionInput = z.input<typeof bookingDecisionSchema>;
