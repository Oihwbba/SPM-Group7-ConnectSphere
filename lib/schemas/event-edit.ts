import { z } from "zod";

import type { EventStatus } from "@prisma/client";

import {
  EVENT_END_REQUIRED_MESSAGE,
  EVENT_START_REQUIRED_MESSAGE,
  eventPeriodError,
} from "@/lib/schemas/event";

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
  | (typeof ARRANGEMENT_FIELDS)[number]
  // SCRUM-171 AC5: a routine field too, but a choice rather than text.
  | "registrationRequired";

/**
 * SCRUM-171 AC5 — Registration needed can't be changed to No while people are
 * registered; the message says how many.
 */
export function registrationStillNeededMessage(
  activeRegistrations: number,
): string {
  const people =
    activeRegistrations === 1
      ? "1 active registration"
      : `${activeRegistrations} active registrations`;
  return `This event has ${people}, so Registration needed can't be changed to No.`;
}

/** How each field is named in messages and the audit log. */
export const FIELD_LABEL: Record<EditableField, string> = {
  name: "Event name",
  purpose: "Purpose",
  description: "Description",
  accessibilityNeeds: "Accessibility needs",
  preferredLayout: "Preferred room layout",
  registrationNotes: "Registration needs",
  registrationRequired: "Registration needed",
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
 * AC2, AC3, SCRUM-166 AC13 — a change to these puts an Approved or awaiting
 * safety check out of date: the layout and accessibility needs (AC2), and the
 * date, time and expected attendance (AC3) the Safety Officer reviewed.
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

/**
 * AC3, SCRUM-26 AC1 — the reason a confirmed edit flags the event's
 * arrangements with, naming what changed: "The event's start, end and
 * expected attendance changed."
 */
export function arrangementsFlaggedReason(fields: EditableField[]): string {
  const names = fields.map((field) => FIELD_LABEL[field].toLowerCase());
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `The event's ${list} changed.`;
}

export const CONFIRMATION_OUT_OF_DATE_MESSAGE =
  "Something was booked or reserved for this event since you were warned. Check the list again before saving.";

export const PAST_START_MESSAGE = "The start can't be in the past.";

const text = (max: number) => z.string().trim().max(max).optional();
// The request form caps none of these, so an event it accepted always saves here.
const uncapped = z.string().trim().optional();

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
    accessibilityNeeds: uncapped,
    preferredLayout: uncapped,
    registrationNotes: uncapped,
    // SCRUM-171 AC5: "yes" or "no" from the form; left out, it stays as it is.
    registrationRequired: z.preprocess(
      (value) => (value === "yes" ? true : value === "no" ? false : value),
      z.boolean().optional(),
    ),
    programme: text(5000),
    specialRequests: text(5000),
    // UTC ISO strings, converted from Singapore wall time in the browser.
    startAt: z.string().min(1, EVENT_START_REQUIRED_MESSAGE),
    endAt: z.string().min(1, EVENT_END_REQUIRED_MESSAGE),
    expectedAttendance: z.coerce
      .number({ invalid_type_error: "Attendance must be a positive whole number." })
      .int("Attendance must be a positive whole number.")
      .positive("Attendance must be a positive whole number."),
    venueRequirements: uncapped,
    equipmentRequirements: uncapped,
    // SCRUM-26 AC1: the arrangements the Coordinator was warned about and
    // agreed to flag. Empty until they have seen the warning.
    confirmedArrangements: z.array(z.string()).default([]),
  })
  .superRefine((data, ctx) => {
    // SCRUM-190 AC3: the same one-day rule as the request form.
    const periodError = eventPeriodError(
      new Date(data.startAt),
      new Date(data.endAt),
    );
    if (periodError) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: periodError,
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
