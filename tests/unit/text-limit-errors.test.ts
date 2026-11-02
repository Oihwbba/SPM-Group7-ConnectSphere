import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { rejectPlanningEvent, transitionEventStatus } from "@/app/(app)/events/actions";
import { cancelEvent } from "@/app/(app)/events/cancel-actions";
import { decideChangeRequest } from "@/app/(app)/events/change-decision-actions";
import { requestClarification } from "@/app/(app)/events/clarification-actions";
import { decideBookingRequest } from "@/app/(app)/bookings/actions";
import { recordSafetyCheckOutcome } from "@/app/(app)/safety-checks/actions";

// SCRUM-264 — the seven text boxes limited to 2,000 characters answer a refusal
// with a message for the field (SCRUM-132 AC4). Test cases:
// docs/testing/SCRUM-264.md. Session and database are mocked, and each row is
// "not found", so reaching that read shows a text passed validation.

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    eventChangeRequest: { findUnique: vi.fn() },
    booking: { findUnique: vi.fn() },
    safetyCheck: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = auth as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;
const reads = [
  prisma.event.findUnique,
  prisma.eventChangeRequest.findUnique,
  prisma.booking.findUnique,
  prisma.safetyCheck.findUnique,
] as unknown as Mock[];

function sessionFor(role: Role): Session {
  return {
    user: { id: "usr_1", role, name: "Test User", email: "usr_1@test.local" },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const AT_LIMIT = "x".repeat(2000);
const OVER_LIMIT = "x".repeat(2001);
const REJECTION = "Keep the rejection reason under 2000 characters.";

const BOXES = [
  {
    action: "requestClarification",
    role: "COORDINATOR",
    send: (text: string) => requestClarification({ eventId: "evt1", message: text }),
    field: "message",
    message: "Keep the message under 2000 characters.",
    refusal: "Please fix the highlighted fields.",
    notFound: "Event not found.",
  },
  {
    action: "transitionEventStatus",
    role: "COORDINATOR",
    send: (text: string) =>
      transitionEventStatus({
        eventId: "evt1",
        nextStatus: "REJECTED",
        decisionReason: text,
        rejectionOutcome: "AMEND_AND_RESUBMIT",
      }),
    field: "decisionReason",
    message: REJECTION,
    refusal: REJECTION,
    notFound: "Event not found.",
  },
  {
    action: "rejectPlanningEvent",
    role: "COORDINATOR",
    send: (text: string) =>
      rejectPlanningEvent({
        eventId: "evt1",
        decisionReason: text,
        rejectionOutcome: "AMEND_AND_RESUBMIT",
      }),
    field: "decisionReason",
    message: REJECTION,
    refusal: REJECTION,
    notFound: "Event not found.",
  },
  {
    action: "cancelEvent",
    role: "COORDINATOR",
    send: (text: string) => cancelEvent({ eventId: "evt1", reason: text }),
    field: "reason",
    message: "Keep the cancellation reason under 2000 characters.",
    refusal: "Keep the cancellation reason under 2000 characters.",
    notFound: "Event not found.",
  },
  {
    action: "decideChangeRequest",
    role: "COORDINATOR",
    send: (text: string) =>
      decideChangeRequest({ changeRequestId: "cr1", decision: "REJECTED", reason: text }),
    field: "reason",
    message: REJECTION,
    refusal: REJECTION,
    notFound: "Change request not found.",
  },
  {
    action: "decideBookingRequest",
    role: "VENUE_STAFF",
    send: (text: string) =>
      decideBookingRequest({ bookingId: "bkg1", decision: "REJECTED", reason: text }),
    field: "reason",
    message: REJECTION,
    refusal: REJECTION,
    notFound: "Booking request not found.",
  },
  {
    action: "recordSafetyCheckOutcome",
    role: "SAFETY_OFFICER",
    send: (text: string) =>
      recordSafetyCheckOutcome({ checkId: "chk1", outcome: "REJECTED", note: text }),
    field: "note",
    message: "Keep the note under 2000 characters.",
    refusal: "Keep the note under 2000 characters.",
    notFound: "Safety check not found.",
  },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  for (const read of reads) read.mockResolvedValue(null);
});

describe("the seven 2,000-character text boxes — SCRUM-264", () => {
  it.each(BOXES)(
    "SCRUM-264 [AC1, AC2] TC-264-02: $action refuses 2,001 characters with the field's message, and reads and writes nothing",
    async ({ role, send, field, message, refusal }) => {
      mockAuth.mockResolvedValue(sessionFor(role));

      expect(await send(OVER_LIMIT)).toEqual({
        ok: false,
        error: refusal,
        fieldErrors: { [field]: [message] },
      });
      for (const read of reads) expect(read).not.toHaveBeenCalled();
      expect(mockTransaction).not.toHaveBeenCalled();
    },
  );

  it.each(BOXES)(
    "SCRUM-264 [AC3] TC-264-03: $action takes exactly 2,000 characters",
    async ({ role, send, notFound }) => {
      mockAuth.mockResolvedValue(sessionFor(role));

      expect(await send(AT_LIMIT)).toEqual({ ok: false, error: notFound });
    },
  );

  it.each([
    {
      action: "transitionEventStatus",
      send: () => transitionEventStatus({ eventId: "", nextStatus: "APPROVED" }),
      error: "Please provide a valid event status action.",
    },
    {
      action: "rejectPlanningEvent",
      send: () => rejectPlanningEvent({}),
      error: "Please provide a valid event to reject.",
    },
    {
      action: "cancelEvent",
      send: () => cancelEvent({}),
      error: "Please provide a valid event to cancel.",
    },
    {
      action: "decideChangeRequest",
      send: () => decideChangeRequest({ changeRequestId: "cr1", decision: "MAYBE" }),
      error: "Please choose Approve or Reject.",
    },
  ])(
    "SCRUM-264 [AC4] TC-264-04: $action keeps its own refusal for input the user can't fix",
    async ({ send, error }) => {
      mockAuth.mockResolvedValue(sessionFor("COORDINATOR"));

      expect(await send()).toEqual({ ok: false, error });
      for (const read of reads) expect(read).not.toHaveBeenCalled();
    },
  );
});
