import { z } from "zod";
import type { EventStatus } from "@prisma/client";

import { isValidPeriod } from "@/lib/period";

/** A venue is requested only for an event that has already been approved. */
export const BOOKABLE_EVENT_STATUSES: EventStatus[] = ["APPROVED", "PLANNING"];

/**
 * Expected attendance above what the venue holds is refused, on the form and
 * by the server. Attendance exactly equal to capacity fits (the same boundary
 * SCRUM-40 uses for suitability).
 */
export function overCapacityMessage(
  venueName: string,
  capacity: number,
  attendance: number,
): string {
  return `${venueName} holds up to ${capacity} people; ${attendance} expected is over its capacity.`;
}

export const PAST_START_MESSAGE = "The start time cannot be in the past.";

/**
 * How far in the past a start may be and still count as "now": a request
 * started at the current half hour is not refused over the seconds it took to
 * submit. The equipment form allows the same minute (SCRUM-31).
 */
const PAST_START_GRACE_MS = 60_000;

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
    // A booking for a period that has already started cannot be honoured.
    if (period.startAt.getTime() < Date.now() - PAST_START_GRACE_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startAt"],
        message: PAST_START_MESSAGE,
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
