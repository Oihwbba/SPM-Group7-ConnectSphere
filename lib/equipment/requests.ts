import type { EquipmentRequestStatus, EventStatus } from "@prisma/client";

/**
 * SCRUM-27 — an equipment request is raised for an event that is going ahead.
 * Earlier statuses may still be rejected, and the later ones are finished.
 */
export const REQUESTABLE_EVENT_STATUSES = [
  "APPROVED",
  "PLANNING",
  "CONFIRMED",
] as const satisfies readonly EventStatus[];

/**
 * SCRUM-27 AC 7 — a request still waiting on Technical Support. Must match
 * the partial unique index "EquipmentRequest_one_open_per_event", which
 * allows at most one request in these statuses per event.
 */
export const OPEN_REQUEST_STATUSES = [
  "PENDING_REVIEW",
  "IN_REVIEW",
] as const satisfies readonly EquipmentRequestStatus[];

/** The words the stories use: "Pending Review", "In Review", "Approved"… */
export const EQUIPMENT_REQUEST_STATUS_LABEL: Record<
  EquipmentRequestStatus,
  string
> = {
  PENDING_REVIEW: "Pending Review",
  IN_REVIEW: "In Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};
