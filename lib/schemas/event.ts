import { z } from "zod";

/** Room layouts offered as presets on the request and edit forms. */
export const LAYOUT_OPTIONS = [
  "Theatre",
  "Classroom",
  "Banquet",
  "Boardroom",
  "U-Shape",
  "Cocktail / Standing",
];

/**
 * Helper to validate attendance: must be a positive whole number (> 0).
 */
const positiveAttendance = z
  .number({ invalid_type_error: "Attendance must be a positive whole number." })
  .int("Attendance must be a positive whole number.")
  .positive("Attendance must be a positive whole number.");

export const REGISTRATION_NEEDED_REQUIRED_MESSAGE =
  "Choose whether the event needs registration.";

/**
 * SCRUM-171 AC1 — Registration needed, as the form sends it ("yes" or "no"),
 * as a boolean. Left unanswered it is undefined.
 */
const registrationNeeded = (value: unknown) =>
  value === "yes"
    ? true
    : value === "no"
      ? false
      : value === ""
        ? undefined
        : value;

/**
 * SCRUM-171 AC3 — how Registration needed reads. A request made before the
 * choice existed has none.
 */
export function registrationNeededLabel(
  registrationRequired: boolean | null,
): string {
  return registrationRequired === true
    ? "Yes"
    : registrationRequired === false
      ? "No"
      : "Not answered";
}

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
    // SCRUM-171 AC2: a draft can be saved without choosing.
    registrationRequired: z.preprocess(
      registrationNeeded,
      z.boolean().optional(),
    ),
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
 * and whether the event needs registration (SCRUM-171).
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
    // SCRUM-171 AC1, AC2: whether the event needs registration is required to
    // submit; a note about registration is optional.
    registrationRequired: z.preprocess(
      registrationNeeded,
      z.boolean({
        required_error: REGISTRATION_NEEDED_REQUIRED_MESSAGE,
        invalid_type_error: REGISTRATION_NEEDED_REQUIRED_MESSAGE,
      }),
    ),
    registrationNotes: z.string().trim().max(5000).optional(),
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

/**
 * SCRUM-130 AC6 — drafts never expire (AC5), so one can be opened after its
 * proposed start has passed. The draft editor warns about it; submitting is
 * already refused by the submit schema above (SCRUM-13 AC9), with the same
 * "before now" rule.
 */
export const PAST_DRAFT_DATES_MESSAGE =
  "Dates are in the past – update them before submitting";

export function draftStartIsInPast(
  startAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!startAt) return false;
  const start = new Date(startAt);
  return !Number.isNaN(start.getTime()) && start < now;
}

export type CreateDraftEventInput = z.infer<typeof createDraftEventSchema>;
export type SubmitEventRequestInput = z.infer<typeof submitEventRequestSchema>;

/** SCRUM-170 AC4 — the Coordinator records that the event needs no equipment. */
export const noEquipmentDecisionSchema = z.object({
  eventId: z.string().min(1),
});

export const NO_EQUIPMENT_NOT_PLANNING_MESSAGE =
  "Equipment can only be decided while the event is in Planning.";

export const NO_EQUIPMENT_HAS_REQUEST_MESSAGE =
  "This event has an equipment request. Withdraw it before recording that no equipment is needed.";
