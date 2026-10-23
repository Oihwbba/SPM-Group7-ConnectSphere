import { z } from "zod";
import type { EventStatus } from "@prisma/client";

import { formatDateTime } from "@/lib/datetime";
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
 * starting this minute is not refused over the seconds it took to submit.
 * The equipment form allows the same minute (SCRUM-31).
 */
const PAST_START_GRACE_MS = 60_000;

export const INVALID_PERIOD_MESSAGE =
  "The requested period is invalid: the end must be after the start.";

/**
 * SCRUM-188 AC1 — the period a venue request is for: exactly the event's, not
 * rounded, so the event, its booking and venue search (SCRUM-38 AC2) never
 * disagree about the time. An event without both dates has no period yet.
 */
export function eventBookingPeriod(event: {
  startAt: Date | string | null;
  endAt: Date | string | null;
}): { startAt: Date; endAt: Date } | null {
  if (!event.startAt || !event.endAt) return null;
  return { startAt: new Date(event.startAt), endAt: new Date(event.endAt) };
}

export const EVENT_NOT_SCHEDULED_MESSAGE =
  "This event has no dates or expected attendance yet. Set them on the event before requesting a venue.";

/**
 * SCRUM-188 AC2 — a venue is booked for exactly the event's period: neither
 * longer nor shorter.
 */
export function isEventPeriod(
  period: { startAt: Date; endAt: Date },
  eventPeriod: { startAt: Date; endAt: Date },
): boolean {
  return (
    period.startAt.getTime() === eventPeriod.startAt.getTime() &&
    period.endAt.getTime() === eventPeriod.endAt.getTime()
  );
}

export function notEventPeriodMessage(period: {
  startAt: Date;
  endAt: Date;
}): string {
  return `The requested period must be the event's: ${formatDateTime(period.startAt)} to ${formatDateTime(period.endAt)}.`;
}

/** SCRUM-162 AC4 — a venue's attendance is from 1 to the event's expected attendance. */
export function attendanceOverEventMessage(attendance: number): string {
  return `The expected attendance for this venue must be from 1 to the event's ${attendance}.`;
}

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
    // SCRUM-40 AC3 — compared with the venue's features for suitability.
    requiredAccessibilityFeatures: z
      .array(z.string().trim().min(1))
      .default([]),
    requestedLayout: z.string().trim().max(100).optional(),
    requestNotes: z.string().trim().max(2000).optional(),
  })
  .superRefine(refinePeriod);

/**
 * SCRUM-50 AC5 — the period checks the request and the live check share, so
 * the form is never told a period is free that submitting would refuse.
 */
function refinePeriod(
  data: { startAt: string; endAt: string },
  ctx: z.RefinementCtx,
) {
  const period = {
    startAt: new Date(data.startAt),
    endAt: new Date(data.endAt),
  };
  // An end at or before the start is refused before anything else happens.
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
}

/**
 * SCRUM-50 — the form's live question: is this venue free for this period?
 * Only the venue and a period that is valid and not already started; the
 * rest of the request is checked when it is submitted.
 */
export const venueAvailabilityQuerySchema = z
  .object({
    venueId: z.string().min(1, "Choose a venue."),
    startAt: z.string().min(1, INVALID_PERIOD_MESSAGE),
    endAt: z.string().min(1, INVALID_PERIOD_MESSAGE),
  })
  .superRefine(refinePeriod);

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

/**
 * SCRUM-163 AC1 — Venue Staff hold a pending request until `holdExpiresAt`
 * (a UTC ISO instant, converted from Singapore wall time by the form), with a
 * note of what the Coordinator must finalise. That the expiry is after now and
 * before the booking starts is checked by the action, which knows the booking.
 */
export const bookingHoldSchema = z.object({
  bookingId: z.string().min(1),
  holdExpiresAt: z
    .string({ required_error: "Choose when the hold expires." })
    .min(1, "Choose when the hold expires.")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: "Choose when the hold expires.",
    }),
  holdNote: z
    .string({ required_error: "Say what the Coordinator must finalise." })
    .trim()
    .min(1, "Say what the Coordinator must finalise.")
    .max(500),
});

/** SCRUM-163 AC3 — the Coordinator confirms or releases one hold. */
export const holdSettlementSchema = z.object({
  bookingId: z.string().min(1),
});

/** SCRUM-142 AC4 — the Coordinator withdraws one pending venue request. */
export const bookingWithdrawalSchema = holdSettlementSchema;

export function holdExpiryMessage(startAt: Date): string {
  return `The hold must expire after now and before the booking starts (${formatDateTime(startAt)}).`;
}

export type BookingRequestInput = z.input<typeof bookingRequestSchema>;
export type BookingDecisionInput = z.input<typeof bookingDecisionSchema>;
