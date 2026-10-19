import type {
  BookingStatus,
  EventStatus,
  RegistrationStatus,
  ReservationStatus,
} from "@prisma/client";

/**
 * SCRUM-131 — the display names every screen uses. Stored values can differ:
 * a reservation stored as CONFIRMED is shown as Reserved, so it is never
 * mistaken for an event's Confirmed status. Equipment request, change request
 * and safety check names live beside their rules, in
 * `lib/equipment/requests.ts`, `lib/schemas/change-request.ts` and
 * `lib/safety-checks.ts`.
 *
 * Test cases: docs/testing/SCRUM-131.md.
 */

/** AC1 — the nine event statuses, in lifecycle order. */
export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  PLANNING: "Planning",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
};

/** AC2 */
export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: "Pending",
  HELD: "Held",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

/** AC2 — never "Confirmed". */
export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  CONFIRMED: "Reserved",
  CANCELLED: "Cancelled",
};

/** AC4 — never "Confirmed". */
export const REGISTRATION_STATUS_LABEL: Record<RegistrationStatus, string> = {
  REGISTERED: "Registered",
  WITHDRAWN: "Withdrawn",
  CANCELLED: "Cancelled",
};

/** AC3, SCRUM-26 — a warning badge beside the status, never in place of it. */
export const NEEDS_RECONSIDERATION = "Needs Reconsideration";
