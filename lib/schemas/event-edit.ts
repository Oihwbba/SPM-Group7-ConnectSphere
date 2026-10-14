import { z } from "zod";

import type { EventStatus } from "@prisma/client";

/**
 * SCRUM-25 — the assigned Coordinator edits an event's details directly.
 *
 * AC1: routine fields are every event field except date, time, expected
 * attendance, venue and equipment. Those five belong to SCRUM-26, which
 * warns and flags the arrangements they affect (AC3).
 */
export const ROUTINE_FIELDS = [
  "name",
  "purpose",
  "description",
  "accessibilityNeeds",
  "preferredLayout",
  "registrationNotes",
  "programme",
  "specialRequests",
] as const;

/** AC3 — the fields whose change SCRUM-26 warns about and flags on. */
export const ARRANGEMENT_FIELDS = [
  "startAt",
  "endAt",
  "expectedAttendance",
  "venueRequirements",
  "equipmentRequirements",
] as const;

export type EditableField =
  | (typeof ROUTINE_FIELDS)[number]
  | (typeof ARRANGEMENT_FIELDS)[number];

/** How each field is named in messages and the audit log. */
export const FIELD_LABEL: Record<EditableField, string> = {
  name: "Event name",
  purpose: "Purpose",
  description: "Description",
  accessibilityNeeds: "Accessibility needs",
  preferredLayout: "Preferred room layout",
  registrationNotes: "Registration needs",
  programme: "Programme",
  specialRequests: "Special requests",
  startAt: "Start",
  endAt: "End",
  expectedAttendance: "Expected attendance",
  venueRequirements: "Venue requirements",
  equipmentRequirements: "Equipment requirements",
};

/** AC1 — the statuses in which details can be edited directly. */
export const EDITABLE_STATUSES: EventStatus[] = ["UNDER_REVIEW", "PLANNING"];

/**
 * AC2, SCRUM-166 AC13 — a change to these puts a requested safety check out
 * of date: the layout and accessibility needs, and the date, time and
 * expected attendance the Safety Officer reviewed.
 */
export const SAFETY_RELEVANT_FIELDS: EditableField[] = [
  "preferredLayout",
  "accessibilityNeeds",
  "startAt",
  "endAt",
  "expectedAttendance",
];

export const CONFIRMED_NOT_EDITABLE_MESSAGE =
  "A Confirmed event's details can't be edited directly. Changes go through a change request.";

export const CHANGED_WHILE_EDITING_MESSAGE =
  "This event changed while you were editing it. Reload it and try again.";

/** AC3 — why a change to an arrangement field was refused. */
export function arrangementsAffectedMessage(fields: EditableField[]): string {
  const names = fields.map((field) => FIELD_LABEL[field]).join(", ");
  return `${names} can't be changed while the event has a venue booking or an equipment reservation: it would leave them out of date. Nothing was saved.`;
}

/** AC3 — shown against each field the refusal above names. */
export const ARRANGEMENT_LOCKED_MESSAGE =
  "Can't change while the event has a venue booking or an equipment reservation.";

export const INVALID_PERIOD_MESSAGE = "The end must be after the start.";
export const PAST_START_MESSAGE = "The start can't be in the past.";

const text = (max: number) => z.string().trim().max(max).optional();

export const eventDetailsEditSchema = z
  .object({
    eventId: z.string().min(1),
    name: z
      .string()
      .trim()
      .min(1, "Give the event a name.")
      .max(200, "Keep the name under 200 characters."),
    purpose: text(1000),
    description: text(5000),
    accessibilityNeeds: text(2000),
    preferredLayout: text(100),
    registrationNotes: text(2000),
    programme: text(5000),
    specialRequests: text(5000),
    // UTC ISO strings, converted from Singapore wall time in the browser.
    startAt: z.string().min(1, "Choose a start time."),
    endAt: z.string().min(1, "Choose an end time."),
    expectedAttendance: z.coerce
      .number({ invalid_type_error: "Attendance must be a positive whole number." })
      .int("Attendance must be a positive whole number.")
      .positive("Attendance must be a positive whole number."),
    venueRequirements: text(2000),
    equipmentRequirements: text(2000),
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.startAt).getTime();
    const end = new Date(data.endAt).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: INVALID_PERIOD_MESSAGE,
      });
    }
  });

export type EventDetailsEditInput = z.input<typeof eventDetailsEditSchema>;

export const NOTE_REQUIRED_MESSAGE = "Write the note before adding it.";

/** SCRUM-25 AC6 — an operational note. */
export const operationalNoteSchema = z.object({
  eventId: z.string().min(1),
  body: z
    .string({ required_error: NOTE_REQUIRED_MESSAGE })
    .trim()
    .min(1, NOTE_REQUIRED_MESSAGE)
    .max(2000, "Keep the note under 2000 characters."),
});
