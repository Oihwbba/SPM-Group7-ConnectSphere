import { z } from "zod";

import { timeToMinutes } from "@/lib/venue-hours";

/**
 * SCRUM-159 AC1 — the largest setup or turnaround time, in minutes (one
 * day). The database's `venue_setup_turnaround_range` and
 * `booking_setup_turnaround_range` checks use the same bound, and
 * lib/venue-availability.ts relies on it to know how far around a period an
 * occupied period can reach.
 */
export const MAX_SETUP_TURNAROUND_MINUTES = 1440;

function wholeMinutes(label: string) {
  const message = `${label} must be a whole number of minutes from 0 to 1,440.`;
  return z.preprocess(
    (val) =>
      val === "" || val === null || val === undefined ? undefined : Number(val),
    z
      .number({ required_error: message, invalid_type_error: message })
      .int(message)
      .min(0, message)
      .max(MAX_SETUP_TURNAROUND_MINUTES, message),
  );
}

/**
 * SCRUM-159 AC1 — a venue's setup and turnaround time, as Venue Staff enter
 * them when editing the venue (the form is SCRUM-34's). Each error is
 * reported against its own field.
 */
export const venueTimesSchema = z.object({
  setupMinutes: wholeMinutes("Setup time"),
  turnaroundMinutes: wholeMinutes("Turnaround time"),
});

export type VenueTimes = z.infer<typeof venueTimesSchema>;
/**
 * Facilities, accessibility features and layouts are compared as tags by
 * search and suitability (SCRUM-38, SCRUM-40), so "Sound System" and
 * "sound-system" must be the same tag.
 */
export function toTag(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export const CAPACITY_INVALID_MESSAGE =
  "Capacity must be a whole number greater than 0.";
export const CLOSING_NOT_AFTER_OPENING_MESSAGE =
  "The closing time must be after the opening time.";
export const HOURS_REQUIRED_MESSAGE =
  "Enter an opening and a closing time, or mark the day Closed.";

/** "Projector, Sound System" or ["Projector"] -> ["projector", "sound-system"] */
const tagList = z.preprocess(
  (val) =>
    (Array.isArray(val) ? val : String(val ?? "").split(","))
      .map((v) => toTag(String(v)))
      .filter((v, i, all) => v !== "" && all.indexOf(v) === i),
  z.array(z.string()),
);

const openingDaySchema = z.object({
  weekday: z.number().int().min(1).max(7),
  closed: z.boolean(),
  opensAt: z.string().optional(),
  closesAt: z.string().optional(),
});

/**
 * SCRUM-34 AC3–AC5 — a venue as Venue Staff add or edit it. Name, location,
 * capacity and opening hours are required; opening hours are a time to open
 * and close on each day of the week in SGT, or Closed. Setup and turnaround
 * use SCRUM-159's rule and start at 0. A capacity that isn't a whole number
 * above 0 is reported against capacity (AC4), and a day whose closing time
 * isn't after its opening time against that day, as `hours-<weekday>` (AC5).
 */
export const venueSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Give the venue a name.")
      .max(200, "Keep the name under 200 characters."),
    location: z
      .string()
      .trim()
      .min(1, "Enter the venue's location.")
      .max(500, "Keep the location under 500 characters."),
    capacity: z.preprocess(
      (val) =>
        val === "" || val === null || val === undefined ? undefined : Number(val),
      z
        .number({
          required_error: CAPACITY_INVALID_MESSAGE,
          invalid_type_error: CAPACITY_INVALID_MESSAGE,
        })
        .int(CAPACITY_INVALID_MESSAGE)
        .positive(CAPACITY_INVALID_MESSAGE),
    ),
    facilities: tagList,
    accessibilityFeatures: tagList,
    supportedLayouts: tagList,
    openingHours: z.array(openingDaySchema).length(7),
    setupMinutes: venueTimesSchema.shape.setupMinutes.default(0),
    turnaroundMinutes: venueTimesSchema.shape.turnaroundMinutes.default(0),
    knownRestrictions: z
      .string()
      .trim()
      .max(2000, "Keep the known restrictions under 2000 characters.")
      .optional(),
  })
  .superRefine((venue, ctx) => {
    for (let weekday = 1; weekday <= 7; weekday++) {
      const day = venue.openingHours.find((d) => d.weekday === weekday);
      const path = [`hours-${weekday}`];
      if (!day) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: HOURS_REQUIRED_MESSAGE });
        continue;
      }
      if (day.closed) continue;
      const opens = timeToMinutes(day.opensAt ?? "");
      const closes = timeToMinutes(day.closesAt ?? "");
      if (opens === null || closes === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: HOURS_REQUIRED_MESSAGE });
      } else if (closes <= opens) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message: CLOSING_NOT_AFTER_OPENING_MESSAGE,
        });
      }
    }
  });

export type VenueInput = z.input<typeof venueSchema>;
export type VenueData = z.output<typeof venueSchema>;

/** AC3 — the rows a venue's opening hours are stored as, Monday first. */
export function openingHoursRows(venue: VenueData) {
  return [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
    const day = venue.openingHours.find((d) => d.weekday === weekday)!;
    return {
      weekday,
      opensMinute: day.closed ? null : timeToMinutes(day.opensAt!),
      closesMinute: day.closed ? null : timeToMinutes(day.closesAt!),
    };
  });
}

export const venueUpdateSchema = venueSchema.and(
  z.object({ venueId: z.string().min(1, "Choose a venue.") }),
);

/** AC10 — an edit that would leave future bookings no longer fitting. */
export const VENUE_CHANGE_AFFECTS_BOOKINGS_MESSAGE =
  "This change would leave the future bookings below no longer fitting the venue, so nothing was saved. Ask their Coordinators to change or cancel them first.";
/** AC11 — a venue with future bookings isn't retired. */
export const VENUE_RETIRE_HAS_BOOKINGS_MESSAGE =
  "This venue has the future bookings below, so it can't be retired yet. Nothing was changed. Ask their Coordinators to move or cancel them first.";

export const venueRetireSchema = z.object({
  venueId: z.string().min(1, "Choose a venue."),
});
