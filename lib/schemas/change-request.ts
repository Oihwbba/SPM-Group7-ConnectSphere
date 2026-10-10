import { z } from "zod";
import type { ChangeRequestStatus } from "@prisma/client";

import {
  CLARIFIABLE_FIELDS,
  checkSchedule,
  requestFieldValues,
} from "@/lib/schemas/clarification";

/**
 * SCRUM-41 AC1 — the event fields a change request can ask to change: every
 * field of the request form. "schedule" is the start and end together, as in
 * a clarification (SCRUM-108).
 */
export const CHANGEABLE_FIELDS = {
  ...CLARIFIABLE_FIELDS,
  programme: "Programme",
  specialRequests: "Special requests",
} as const;

export type ChangeableField = keyof typeof CHANGEABLE_FIELDS;

/**
 * SCRUM-41 AC5 — date, time, expected attendance, venue and equipment. An
 * approved change to one of these flags the event's arrangements (SCRUM-128
 * AC4).
 */
export const IMPACTFUL_FIELDS: readonly ChangeableField[] = [
  "schedule",
  "expectedAttendance",
  "venueRequirements",
  "equipmentRequirements",
];

const optionalText = (label: string, max: number) =>
  z.string().trim().max(max, `Keep ${label} under ${max} characters.`);

/**
 * SCRUM-41 AC4 — the requested values, under the request form's rules. The
 * programme and special requests are optional on the form, so they may be
 * cleared.
 */
export const changeRequestChangesSchema = requestFieldValues
  .extend({
    programme: optionalText("the programme", 5000),
    specialRequests: optionalText("special requests", 5000),
  })
  .partial()
  .strict()
  .superRefine(checkSchedule);

export type ChangeRequestChanges = z.infer<typeof changeRequestChangesSchema>;

export const NO_CHANGE_MESSAGE =
  "Change at least one field, or ask to cancel the event.";

/** SCRUM-41 AC1 — field changes, or a cancellation with its reason. */
export const raiseChangeRequestSchema = z
  .object({
    eventId: z.string().min(1),
    changes: changeRequestChangesSchema.default({}),
    requestsCancellation: z.boolean().default(false),
    reason: z
      .string()
      .trim()
      .max(2000, "Keep the reason under 2000 characters.")
      .optional()
      .transform((reason) => reason || undefined),
  })
  .superRefine((request, ctx) => {
    const changesSomething = Object.keys(request.changes).length > 0;
    if (!request.requestsCancellation) {
      if (!changesSomething) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: NO_CHANGE_MESSAGE,
          path: ["changes"],
        });
      }
      return;
    }
    if (!request.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Give a reason for cancelling the event.",
        path: ["reason"],
      });
    }
    if (changesSomething) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A cancellation request can't also change fields.",
        path: ["changes"],
      });
    }
  });

export type RaiseChangeRequestInput = z.infer<typeof raiseChangeRequestSchema>;

/** Which changeable field a requested value belongs to. */
export function changeableFieldOf(
  key: keyof ChangeRequestChanges,
): ChangeableField {
  return key === "startAt" || key === "endAt" ? "schedule" : key;
}

/** How a stored ChangeRequestField's name reads on screen. */
export function changeFieldLabel(fieldName: string): string {
  if (fieldName === "startAt") return "Start";
  if (fieldName === "endAt") return "End";
  return CHANGEABLE_FIELDS[fieldName as ChangeableField] ?? fieldName;
}

/** SCRUM-41 AC6 — the status names the Organiser sees. */
export const CHANGE_REQUEST_STATUS_LABEL: Record<ChangeRequestStatus, string> =
  {
    PENDING_REVIEW: "Submitted",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  };
