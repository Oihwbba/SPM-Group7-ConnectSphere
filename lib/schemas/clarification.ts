import { z } from "zod";

/**
 * SCRUM-108 AC1 — the request-form fields a Coordinator can let the Organiser
 * change in a clarification answer. "schedule" is the start and end together,
 * since one is rarely changed without the other.
 */
export const CLARIFIABLE_FIELDS = {
  name: "Event name",
  purpose: "Purpose",
  description: "Description",
  schedule: "Date and time",
  expectedAttendance: "Expected attendance",
  venueRequirements: "Venue requirements",
  accessibilityNeeds: "Accessibility needs",
  preferredLayout: "Room layout",
  equipmentRequirements: "Equipment requirements",
  registrationNotes: "Registration needs",
} as const;

export type ClarifiableField = keyof typeof CLARIFIABLE_FIELDS;

const clarifiableField = z.enum(
  Object.keys(CLARIFIABLE_FIELDS) as [ClarifiableField, ...ClarifiableField[]],
);

/**
 * SCRUM-18 — a Coordinator asks the Organiser for more information, and
 * (SCRUM-108 AC1) names the fields the answer may change; none means a text
 * answer only.
 */
export const requestClarificationSchema = z.object({
  eventId: z.string().min(1),
  message: z
    .string()
    .trim()
    .min(1, "Say what you need clarified.")
    .max(2000, "Keep the message under 2000 characters."),
  editableFields: z
    .array(clarifiableField)
    .default([])
    .transform((fields) => [...new Set(fields)]),
});

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} can't be empty.`)
    .max(max, `Keep ${label.toLowerCase()} under ${max} characters.`);

/**
 * SCRUM-108 AC2 — new values for the fields the clarification named. The
 * rules match the request form's (submitEventRequestSchema), so an answer
 * can't leave the request in a state it couldn't have been submitted in.
 */
export const clarificationChangesSchema = z
  .object({
    name: requiredText("The event name", 200),
    purpose: requiredText("The purpose", 1000),
    description: requiredText("The description", 5000),
    startAt: z.string().min(1),
    endAt: z.string().min(1),
    expectedAttendance: z
      .number({ invalid_type_error: "Attendance must be a positive whole number." })
      .int("Attendance must be a positive whole number.")
      .positive("Attendance must be a positive whole number."),
    venueRequirements: requiredText("Venue requirements", 5000),
    accessibilityNeeds: requiredText("Accessibility needs", 5000),
    preferredLayout: requiredText("Room layout", 200),
    equipmentRequirements: requiredText("Equipment requirements", 5000),
    registrationNotes: requiredText("Registration needs", 5000),
  })
  .partial()
  .strict()
  .superRefine((changes, ctx) => {
    if (changes.startAt === undefined && changes.endAt === undefined) return;
    if (changes.startAt === undefined || changes.endAt === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Give both the start and the end.",
        path: ["endAt"],
      });
      return;
    }
    const start = new Date(changes.startAt);
    const end = new Date(changes.endAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid date format.",
        path: ["startAt"],
      });
    } else if (start < new Date()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Proposed date cannot be in the past.",
        path: ["startAt"],
      });
    } else if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Proposed end date and time must be strictly after the start date and time.",
        path: ["endAt"],
      });
    }
  });

export type ClarificationChanges = z.infer<typeof clarificationChangesSchema>;

/** Which named field each changed value belongs to. */
export function fieldOfChange(key: keyof ClarificationChanges): ClarifiableField {
  return key === "startAt" || key === "endAt" ? "schedule" : key;
}

/**
 * SCRUM-18 — the Organiser's reply to an open clarification request, with
 * (SCRUM-108 AC2) any changes to the fields it named.
 */
export const respondClarificationSchema = z.object({
  clarificationId: z.string().min(1),
  response: z
    .string()
    .trim()
    .min(1, "Enter a response before sending.")
    .max(2000, "Keep the response under 2000 characters."),
  changes: clarificationChangesSchema.default({}),
});

export type RequestClarificationInput = z.infer<typeof requestClarificationSchema>;
export type RespondClarificationInput = z.infer<typeof respondClarificationSchema>;
