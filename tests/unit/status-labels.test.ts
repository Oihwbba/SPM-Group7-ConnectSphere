import { describe, it, expect } from "vitest";

import {
  BOOKING_STATUS_LABEL,
  EVENT_STATUS_LABEL,
  NEEDS_RECONSIDERATION,
  REGISTRATION_STATUS_LABEL,
  RESERVATION_STATUS_LABEL,
} from "@/lib/status-labels";
import { EQUIPMENT_REQUEST_STATUS_LABEL } from "@/lib/equipment/requests";
import { CHANGE_REQUEST_STATUS_LABEL } from "@/lib/schemas/change-request";
import { NOT_REQUESTED, SAFETY_CHECK_LABEL } from "@/lib/safety-checks";

// SCRUM-131 — the expected names are copied from the acceptance criteria, in
// the order they list them, so a renamed or reordered status fails here.
describe("SCRUM-131 status display names", () => {
  it("SCRUM-131 [AC1] TC-131-01: event statuses are shown exactly as the nine agreed names, in lifecycle order", () => {
    expect(Object.values(EVENT_STATUS_LABEL)).toEqual([
      "Draft",
      "Submitted",
      "Under Review",
      "Approved",
      "Planning",
      "Confirmed",
      "Completed",
      "Cancelled",
      "Rejected",
    ]);
  });

  it("SCRUM-131 [AC2] TC-131-02: venue bookings are shown as Pending, Held, Approved, Rejected, Expired or Cancelled", () => {
    expect(BOOKING_STATUS_LABEL).toEqual({
      PENDING: "Pending",
      HELD: "Held",
      APPROVED: "Approved",
      REJECTED: "Rejected",
      EXPIRED: "Expired",
      CANCELLED: "Cancelled",
    });
  });

  it("SCRUM-131 [AC2] TC-131-02: equipment requests are shown as Pending Review, In Review, Approved, Rejected or Cancelled", () => {
    expect(EQUIPMENT_REQUEST_STATUS_LABEL).toEqual({
      PENDING_REVIEW: "Pending Review",
      IN_REVIEW: "In Review",
      APPROVED: "Approved",
      REJECTED: "Rejected",
      CANCELLED: "Cancelled",
    });
  });

  it("SCRUM-131 [AC2] TC-131-03: a reservation stored as CONFIRMED is shown as Reserved, never Confirmed", () => {
    expect(RESERVATION_STATUS_LABEL).toEqual({
      CONFIRMED: "Reserved",
      CANCELLED: "Cancelled",
    });
    expect(Object.values(RESERVATION_STATUS_LABEL)).not.toContain("Confirmed");
  });

  it("SCRUM-131 [AC3] TC-131-04: the flag is named Needs Reconsideration, which is no booking or reservation status", () => {
    expect(NEEDS_RECONSIDERATION).toBe("Needs Reconsideration");
    expect([
      ...Object.values(BOOKING_STATUS_LABEL),
      ...Object.values(RESERVATION_STATUS_LABEL),
    ]).not.toContain(NEEDS_RECONSIDERATION);
  });

  it("SCRUM-131 [AC4] TC-131-06: registrations are shown as Registered, Withdrawn or Cancelled, never Confirmed", () => {
    expect(REGISTRATION_STATUS_LABEL).toEqual({
      REGISTERED: "Registered",
      WITHDRAWN: "Withdrawn",
      CANCELLED: "Cancelled",
    });
    expect(Object.values(REGISTRATION_STATUS_LABEL)).not.toContain("Confirmed");
  });

  it("SCRUM-131 [AC5] TC-131-07: a change request stored as PENDING_REVIEW is shown as Submitted, then Approved or Rejected", () => {
    expect(CHANGE_REQUEST_STATUS_LABEL).toEqual({
      PENDING_REVIEW: "Submitted",
      APPROVED: "Approved",
      REJECTED: "Rejected",
    });
  });

  it("SCRUM-131 [AC7] TC-131-08: safety checks are shown as Not requested, Awaiting review, Approved, Changes requested, Rejected or Outdated", () => {
    expect([NOT_REQUESTED, ...Object.values(SAFETY_CHECK_LABEL)]).toEqual([
      "Not requested",
      "Awaiting review",
      "Approved",
      "Changes requested",
      "Rejected",
      "Outdated",
    ]);
  });
});
