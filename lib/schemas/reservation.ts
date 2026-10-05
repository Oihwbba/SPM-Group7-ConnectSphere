import type { EventStatus } from "@prisma/client";
import { z } from "zod";

import { REQUESTABLE_EVENT_STATUSES } from "@/lib/equipment/requests";

/**
 * SCRUM-31 — equipment is reserved for any event that can take an equipment
 * request (SCRUM-27 AC 1), so the two rules cannot drift apart: a request
 * Technical Support could never reserve stock for would be unfulfillable.
 */
export const RESERVABLE_EVENT_STATUSES: EventStatus[] = [
  ...REQUESTABLE_EVENT_STATUSES,
];

const reservationFields = {
  equipmentId: z.string().min(1, "Select an equipment type."),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number.")
    .positive("Quantity must be greater than zero."),
  startAt: z.string().min(1, "Choose a reservation start time."),
  endAt: z.string().min(1, "Choose a reservation end time."),
};

function validatePeriod(
  data: { startAt: string; endAt: string },
  ctx: z.RefinementCtx,
) {
  const startAt = new Date(data.startAt);
  const endAt = new Date(data.endAt);

  if (Number.isNaN(startAt.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["startAt"],
      message: "Invalid start time.",
    });
  }
  if (Number.isNaN(endAt.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endAt"],
      message: "Invalid end time.",
    });
  }
  if (
    !Number.isNaN(startAt.getTime()) &&
    startAt.getTime() < Date.now() - 60000
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["startAt"],
      message: "Start time cannot be in the past.",
    });
  }
  if (
    !Number.isNaN(startAt.getTime()) &&
    !Number.isNaN(endAt.getTime()) &&
    endAt <= startAt
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endAt"],
      message: "End time must be after the start time.",
    });
  }
}

/**
 * SCRUM-155 — reserving an approved request: one period, one row per type.
 * A type may appear once, so each row is one reservation and one shortfall.
 */
export const requestReservationSchema = z
  .object({
    requestId: z.string().min(1, "Choose an approved request."),
    startAt: reservationFields.startAt,
    endAt: reservationFields.endAt,
    lines: z
      .array(
        z.object({
          equipmentId: reservationFields.equipmentId,
          quantity: reservationFields.quantity,
        }),
      )
      .min(1, "Add at least one equipment type to reserve."),
  })
  .superRefine((data, ctx) => {
    validatePeriod(data, ctx);
    const seen = new Set<string>();
    data.lines.forEach((line, index) => {
      if (line.equipmentId && seen.has(line.equipmentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lines", index, "equipmentId"],
          message: "This equipment type is already on another row.",
        });
      }
      seen.add(line.equipmentId);
    });
  });

export type RequestReservationInput = z.infer<typeof requestReservationSchema>;

export const availabilitySchema = z
  .object({
    equipmentId: reservationFields.equipmentId,
    startAt: reservationFields.startAt,
    endAt: reservationFields.endAt,
  })
  .superRefine(validatePeriod);

export const allAvailabilitySchema = z
  .object({
    startAt: reservationFields.startAt,
    endAt: reservationFields.endAt,
  })
  .superRefine(validatePeriod);

/**
 * SCRUM-30 — an equipment item's schedule. `from` is the point the schedule
 * is read from, so that "all current and future reservations" excludes ones
 * that finished before it.
 */
export const equipmentScheduleSchema = z.object({
  equipmentId: reservationFields.equipmentId,
  from: z.string().min(1, "Choose a date to view from."),
});




