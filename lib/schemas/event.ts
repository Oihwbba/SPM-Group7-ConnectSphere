import { z } from "zod";

/**
 * Helper to validate attendance: must be a positive whole number (> 0).
 */
const positiveAttendance = z
  .number({ invalid_type_error: "Attendance must be a positive whole number." })
  .int("Attendance must be a positive whole number.")
  .positive("Attendance must be a positive whole number.");

/**
 * Zod schema for saving a draft event.
 * Draft events can be partially filled, but if dates or attendance are provided,
 * they must still conform to validity constraints.
 */
export const createDraftEventSchema = z
  .object({
    /** Optional event ID when updating an existing saved draft (User Story 15) */
    id: z.string().optional(),
    name: z
      .string()
      .trim()
      .min(1, "Give the event a name.")
      .max(200, "Keep the name under 200 characters."),
    purpose: z.string().trim().max(1000).optional(),
    description: z
      .string()
      .trim()
      .max(5000, "Keep the description under 5000 characters.")
      .optional(),
    startAt: z.string().optional().or(z.date().optional()),
    endAt: z.string().optional().or(z.date().optional()),
    expectedAttendance: z
      .preprocess(
        (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
        positiveAttendance.optional(),
      ),
    venueRequirements: z.string().trim().optional(),
    requiredFacilities: z.array(z.string()).optional().default([]),
    accessibilityNeeds: z.string().trim().optional(),
    preferredLayout: z.string().trim().optional(),
    equipmentRequirements: z.string().trim().optional(),
    registrationNotes: z.string().trim().optional(),
    programme: z
      .string()
      .trim()
      .max(5000, "Keep programme under 5000 characters.")
      .optional(),
    specialRequests: z
      .string()
      .trim()
      .max(5000, "Keep special requests under 5000 characters.")
      .optional(),
  })
  .superRefine((data, ctx) => {
    const now = new Date();

    if (data.startAt) {
      const startDate = new Date(data.startAt);
      if (isNaN(startDate.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid start date format.",
          path: ["startAt"],
        });
      } else if (startDate < now) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Proposed date cannot be in the past.",
          path: ["startAt"],
        });
      }
    }

    if (data.endAt) {
      const endDate = new Date(data.endAt);
      if (isNaN(endDate.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid end date format.",
          path: ["endAt"],
        });
      }
    }

    if (data.startAt && data.endAt) {
      const startDate = new Date(data.startAt);
      const endDate = new Date(data.endAt);
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && endDate <= startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Proposed end date and time must be strictly after the start date and time.",
          path: ["endAt"],
        });
      }
    }
  });

/**
 * Zod schema for submitting an event request for review.
 * Enforces mandatory fields per W4-33 & User Story 13 AC:
 * name, description, purpose, proposed dates/times, expected attendance,
 * venue requirements, accessibility needs, equipment requirements, room layout,
 * and registration needs.
 */
export const submitEventRequestSchema = z
  .object({
    /** Optional event ID when submitting an existing saved draft (User Story 14 / User Story 15) */
    id: z.string().optional(),
    name: z
      .string()
      .trim()
      .min(1, "Event name is required.")
      .max(200, "Keep the name under 200 characters."),
    purpose: z
      .string()
      .trim()
      .min(1, "Event purpose is required.")
      .max(1000, "Keep purpose under 1000 characters."),
    description: z
      .string()
      .trim()
      .min(1, "Event description is required.")
      .max(5000, "Keep description under 5000 characters."),
    startAt: z
      .string({ required_error: "Proposed start date and time is required." })
      .min(1, "Proposed start date and time is required."),
    endAt: z
      .string({ required_error: "Proposed end date and time is required." })
      .min(1, "Proposed end date and time is required."),
    expectedAttendance: z
      .preprocess(
        (val) => (val === "" || val === null || val === undefined ? NaN : Number(val)),
        positiveAttendance,
      ),
    venueRequirements: z
      .string()
      .trim()
      .min(1, "Venue requirements are required."),
    requiredFacilities: z.array(z.string()).optional().default([]),
    accessibilityNeeds: z
      .string()
      .trim()
      .min(1, "Accessibility needs are required (state wheelchair access, physical seating, or facility arrangements)."),
    preferredLayout: z
      .string()
      .trim()
      .min(1, "Room layout is required."),
    equipmentRequirements: z
      .string()
      .trim()
      .min(1, "Equipment requirements are required."),
    registrationNotes: z
      .string()
      .trim()
      .min(1, "Registration needs are required."),
    programme: z
      .string()
      .trim()
      .max(5000, "Keep programme under 5000 characters.")
      .optional(),
    specialRequests: z
      .string()
      .trim()
      .max(5000, "Keep special requests under 5000 characters.")
      .optional(),
  })
  .superRefine((data, ctx) => {
    const now = new Date();

    if (data.startAt) {
      const startDate = new Date(data.startAt);
      if (isNaN(startDate.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid start date format.",
          path: ["startAt"],
        });
      } else if (startDate < now) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Proposed date cannot be in the past.",
          path: ["startAt"],
        });
      }
    }

    if (data.endAt) {
      const endDate = new Date(data.endAt);
      if (isNaN(endDate.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid end date format.",
          path: ["endAt"],
        });
      }
    }

    if (data.startAt && data.endAt) {
      const startDate = new Date(data.startAt);
      const endDate = new Date(data.endAt);
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && endDate <= startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Proposed end date and time must be strictly after the start date and time.",
          path: ["endAt"],
        });
      }
    }
  });

/**
 * SCRUM-126 — what the Organiser may do after a rejection. The Coordinator's
 * reject dialog and the transition action share this list, and the Organiser
 * reads the same labels next to the reason.
 */
export const rejectionOutcomeSchema = z.enum([
  "AMEND_AND_RESUBMIT",
  "NEW_REQUEST",
]);

export const REJECTION_OUTCOME_LABEL: Record<
  z.infer<typeof rejectionOutcomeSchema>,
  string
> = {
  AMEND_AND_RESUBMIT: "Amend and resubmit",
  NEW_REQUEST: "Submit as a new request",
};

export type CreateDraftEventInput = z.infer<typeof createDraftEventSchema>;
export type SubmitEventRequestInput = z.infer<typeof submitEventRequestSchema>;
