import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { decideBookingRequest, holdBookingRequest } from "@/app/(app)/bookings/actions";
import {
  suggestAlternativeEquipment,
  updateEquipmentRequestStatus,
} from "@/app/(app)/equipment-requests/actions";
import { reserveEquipmentRequest } from "@/app/(app)/equipment/actions";

// SCRUM-121 AC5 — a member of staff who also organises or coordinates an
// event can't decide its venue booking or review or reserve its equipment,
// with the database mocked: each action is refused, and nothing is written.
// Test cases: docs/testing/SCRUM-121.md.
const db = vi.hoisted(() => ({
  booking: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  equipmentRequest: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  equipment: { findFirst: vi.fn() },
  reservation: { findMany: vi.fn(), createMany: vi.fn() },
  equipmentUnavailability: { findMany: vi.fn() },
  venueUnavailability: { findMany: vi.fn() },
  auditLog: { create: vi.fn() },
  notification: { create: vi.fn(), createMany: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = auth as unknown as Mock;
const DENIED = "You do not have permission to do that.";
const signedInAs = (role: Role, additionalRoles: Role[]) =>
  mockAuth.mockResolvedValue({
    user: { id: "usr_me", role, additionalRoles, name: "Me", email: "me@test.local" },
    expires: "2999-01-01T00:00:00.000Z",
  } satisfies Session);

const START = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const END = new Date(START.getTime() + 4 * 60 * 60 * 1000);

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation((cb: (tx: typeof db) => unknown) => cb(db));
});

function expectNothingWritten() {
  expect(db.booking.updateMany).not.toHaveBeenCalled();
  expect(db.equipmentRequest.updateMany).not.toHaveBeenCalled();
  expect(db.reservation.createMany).not.toHaveBeenCalled();
  expect(db.auditLog.create).not.toHaveBeenCalled();
  expect(db.notification.create).not.toHaveBeenCalled();
  expect(db.notification.createMany).not.toHaveBeenCalled();
}

describe("a venue booking for your own event — SCRUM-121 AC5", () => {
  const booking = (organiserId: string, coordinatorId: string | null) => ({
    id: "bkg_1",
    venueId: "ven_1",
    startAt: START,
    endAt: END,
    status: "PENDING",
    holdExpiresAt: null,
    holdApprovedAt: null,
    needsReconsideration: false,
    createdAt: new Date(),
    requestedById: "usr_coord",
    venue: { name: "Hall", isActive: true, setupMinutes: 0, turnaroundMinutes: 0, openingHours: [] },
    event: { id: "evt_1", name: "Expo", organiserId, coordinatorId },
  });

  it("SCRUM-121 [AC5] TC-121-05: Venue Staff who coordinate the event can't approve its booking, and nothing is written", async () => {
    signedInAs("VENUE_STAFF", ["COORDINATOR"]);
    db.booking.findUnique.mockResolvedValue(booking("usr_org", "usr_me"));

    expect(await decideBookingRequest({ bookingId: "bkg_1", decision: "APPROVED" })).toEqual({
      ok: false,
      error: DENIED,
    });
    expect(db.$transaction).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("SCRUM-121 [AC5] TC-121-05: Venue Staff who organise the event can't reject or hold its booking either", async () => {
    signedInAs("VENUE_STAFF", ["ORGANISER"]);
    db.booking.findUnique.mockResolvedValue(booking("usr_me", "usr_coord"));

    expect(
      await decideBookingRequest({ bookingId: "bkg_1", decision: "REJECTED", reason: "No." }),
    ).toEqual({ ok: false, error: DENIED });
    expect(
      await holdBookingRequest({
        bookingId: "bkg_1",
        holdExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        holdNote: "Confirm numbers.",
      }),
    ).toEqual({ ok: false, error: DENIED });
    expectNothingWritten();
  });
});

describe("equipment for your own event — SCRUM-121 AC5", () => {
  const request = (organiserId: string, coordinatorId: string | null) => ({
    id: "eqr_1",
    status: "IN_REVIEW",
    requestedById: "usr_coord",
    event: { id: "evt_1", name: "Expo", startAt: START, endAt: END, organiserId, coordinatorId },
    lines: [{ id: "ln_1", quantity: 2, equipment: { id: "eqp_projector", type: "Projector" } }],
  });

  it("SCRUM-121 [AC5] TC-121-05: Technical Support who organise the event can't review its request, and nothing is written", async () => {
    signedInAs("TECH_SUPPORT", ["ORGANISER"]);
    db.equipmentRequest.findUnique.mockResolvedValue(request("usr_me", "usr_coord"));

    expect(
      await updateEquipmentRequestStatus({ requestId: "eqr_1", toStatus: "APPROVED" }),
    ).toEqual({ ok: false, error: DENIED });
    expect(
      await suggestAlternativeEquipment({
        requestId: "eqr_1",
        lineId: "ln_1",
        alternativeId: "eqp_other",
      }),
    ).toEqual({ ok: false, error: DENIED });
    expect(db.equipment.findFirst).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("SCRUM-121 [AC5] TC-121-05: Technical Support who coordinate the event can't reserve its equipment, and nothing is reserved", async () => {
    signedInAs("TECH_SUPPORT", ["COORDINATOR"]);
    db.$queryRaw.mockResolvedValue([]);
    db.equipmentRequest.findFirst.mockResolvedValue({
      eventId: "evt_1",
      updatedAt: new Date(),
      createdAt: new Date(),
      event: { organiserId: "usr_org", coordinatorId: "usr_me", startAt: START, endAt: END, reservations: [] },
      lines: [{ equipmentId: "eqp_projector", quantity: 2 }],
    });

    expect(
      await reserveEquipmentRequest({
        requestId: "eqr_1",
        startAt: START.toISOString(),
        endAt: END.toISOString(),
        lines: [{ equipmentId: "eqp_projector", quantity: "2" }],
      }),
    ).toEqual({ ok: false, error: DENIED });
    expect(db.reservation.findMany).not.toHaveBeenCalled();
    expectNothingWritten();
  });
});
