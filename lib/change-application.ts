import type { Prisma } from "@prisma/client";

import { changeFieldLabel } from "@/lib/schemas/change-request";
import { fieldOfChange } from "@/lib/schemas/clarification";

/**
 * SCRUM-128 — applying an approved change request (SCRUM-41) to its event.
 * Test cases: docs/testing/SCRUM-128.md. Why it works this way:
 * docs/adr/0020-deciding-a-change-request.md.
 */

/** One requested value, as SCRUM-41 recorded it. */
export type RecordedChange = {
  fieldName: string;
  newValue: string | null;
  isMajor: boolean;
};

/**
 * AC2 — the event's new values. A change request records every value as text
 * (`auditValue`), so the start and end are read back as dates and the
 * attendance as a number; a cleared optional field becomes empty again.
 */
export function eventUpdateFrom(changes: RecordedChange[]): Prisma.EventUpdateInput {
  const data: Record<string, string | number | Date | null> = {};
  for (const { fieldName, newValue } of changes) {
    data[fieldName] =
      newValue === null
        ? null
        : fieldName === "startAt" || fieldName === "endAt"
          ? new Date(newValue)
          : fieldName === "expectedAttendance"
            ? Number(newValue)
            : newValue;
  }
  return data;
}

/**
 * AC4–AC6 — a change to the date, time, expected attendance, venue or
 * equipment (G4's "significant changes"). SCRUM-41 marked each such field
 * `isMajor` when the request was raised.
 */
export function isImpactful(changes: RecordedChange[]): boolean {
  return changes.some((change) => change.isMajor);
}

/** The event's details a safety check reviews beyond the impactful ones (SCRUM-166 AC13). */
const REVIEWED_BY_SAFETY_CHECK = ["preferredLayout", "accessibilityNeeds"];

/**
 * AC4, SCRUM-166 AC13 — does this change put a safety check out of date? Any
 * impactful change does, and so does a change to the layout or accessibility
 * needs, which the Safety Officer reviews too.
 */
export function outdatesSafetyCheck(changes: RecordedChange[]): boolean {
  return (
    isImpactful(changes) ||
    changes.some((change) => REVIEWED_BY_SAFETY_CHECK.includes(change.fieldName))
  );
}

/**
 * How an approved change reads in a flag's reason and the Organiser's notice:
 * the start and end together read as "Date and time".
 */
export function describeChanges(changes: RecordedChange[]): string {
  return [
    ...new Set(
      changes.map(({ fieldName }) => changeFieldLabel(fieldOfChange(fieldName))),
    ),
  ].join(", ");
}
