import type { RegistrationStatus } from "@prisma/client";

import { remainingCapacity, totalCapacity } from "@/lib/registration-state";

export type RegistrationRow = {
  id: string;
  status: RegistrationStatus;
  attendeeName: string;
};

export type EventRegistrationList = {
  registeredCount: number;
  capacity: number;
  remaining: number;
  registered: RegistrationRow[];
  /** Withdrawn and Cancelled, kept apart so they never count (SCRUM-70 AC4). */
  inactive: RegistrationRow[];
};

/**
 * SCRUM-70 AC3, AC4 — an event's registrations as its Organiser or assigned
 * Coordinator sees them: only Registered ones count toward the total and the
 * remaining places, which use the same capacity rule as the Attendee's view
 * (expected attendance, SCRUM-74).
 */
export function summariseRegistrations(
  rows: RegistrationRow[],
  expectedAttendance: number | null,
): EventRegistrationList {
  const registered = rows.filter((row) => row.status === "REGISTERED");
  const event = { expectedAttendance };
  return {
    registeredCount: registered.length,
    capacity: totalCapacity(event),
    remaining: remainingCapacity(event, registered.length),
    registered,
    inactive: rows.filter((row) => row.status !== "REGISTERED"),
  };
}
