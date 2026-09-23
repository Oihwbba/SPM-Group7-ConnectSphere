import { z } from "zod";

const reservationFields = {
  eventId: z.string().min(1, "Select an approved event."),
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

export const reservationSchema = z
  .object(reservationFields)
  .superRefine(validatePeriod);

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

export type ReservationInput = z.infer<typeof reservationSchema>;



