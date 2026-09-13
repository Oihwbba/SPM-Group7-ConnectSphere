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

const reservationPeriodSchema = z
  .object(reservationFields)
  .superRefine((data, ctx) => {
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
      !Number.isNaN(endAt.getTime()) &&
      endAt <= startAt
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: "End time must be after the start time.",
      });
    }
  });

export const reservationSchema = reservationPeriodSchema;

export const availabilitySchema = z
  .object({
    equipmentId: reservationFields.equipmentId,
    startAt: reservationFields.startAt,
    endAt: reservationFields.endAt,
  })
  .superRefine((data, ctx) => {
    const startAt = new Date(data.startAt);
    const endAt = new Date(data.endAt);
    if (Number.isNaN(startAt.getTime()))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startAt"],
        message: "Invalid start time.",
      });
    if (Number.isNaN(endAt.getTime()))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: "Invalid end time.",
      });
    if (
      !Number.isNaN(startAt.getTime()) &&
      !Number.isNaN(endAt.getTime()) &&
      endAt <= startAt
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: "End time must be after the start time.",
      });
  });

export type ReservationInput = z.infer<typeof reservationSchema>;
