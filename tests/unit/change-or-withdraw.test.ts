import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import {
  changeEquipmentRequest,
  withdrawEquipmentRequest,
} from "@/app/(app)/equipment-requests/actions";
import { withdrawBookingRequest } from "@/app/(app)/bookings/actions";

// SCRUM-142 with the database mocked: every refusal, the races a conditional
// write settles, and that a refusal writes nothing. What a change or
// withdrawal actually writes, against a real Postgres, is in
// tests/integration/change-or-withdraw.test.ts.
const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  equipment: { findMany: vi.fn() },
  equipmentRequest: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn(),
  },
  event: { findUniqueOrThrow: vi.fn() },
  equipmentRequestLine: {
    findMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  equipmentRequestUpdate: { create: vi.fn() },
  reservation: { updateMany: vi.fn() },
  booking: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  auditLog: { create: vi.fn() },
  user: { findMany: vi.fn() },
  notification: { createMany: vi.fn() },
  safetyCheck: { updateMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = auth as unknown as Mock;
const sessionFor = (role: Role, id = "usr_cody"): Session => ({
  user: { id, role, name: id, email: `${id}@test.local` },
  expires: "2999-01-01T00:00:00.000Z",
});
const event = (
  status = "PLANNING",
  coordinatorId: string | null = "usr_cody",
) => ({
  id: "evt_1",
  name: "Gala",
  organiserId: "usr_org",
  coordinatorId,
  status,
});
const request = (overrides: Record<string, unknown> = {}) => ({
  id: "eqr_1",
  status: "APPROVED",
  event: event(),
  lines: [
    {
      id: "eql_mic",
      equipmentId: "eqp_mic",
      quantity: 2,
      technicalRequirements: null,
      equipment: { type: "Microphone" },
    },
  ],
  ...overrides,
});

const nothingWritten = () => {
  expect(db.$transaction).not.toHaveBeenCalled();
  expect(db.equipmentRequest.updateMany).not.toHaveBeenCalled();
  expect(db.booking.updateMany).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(sessionFor("COORDINATOR"));
  db.$transaction.mockImplementation((cb: (tx: typeof db) => unknown) =>
    cb(db),
  );
  db.equipmentRequest.findUnique.mockResolvedValue(request());
  db.equipment.findMany.mockResolvedValue([
    { id: "eqp_mic", type: "Microphone" },
    { id: "eqp_projector", type: "Projector" },
  ]);
  db.equipmentRequest.updateMany.mockResolvedValue({ count: 1 });
  // Re-read under the event lock: still being planned.
  db.equipmentRequest.findUniqueOrThrow.mockResolvedValue({
    event: { status: "PLANNING" },
  });
  db.event.findUniqueOrThrow.mockResolvedValue({ status: "PLANNING" });
  db.equipmentRequestLine.findMany.mockResolvedValue([]);
  db.reservation.updateMany.mockResolvedValue({ count: 0 });
  db.user.findMany.mockResolvedValue([{ id: "usr_tech" }]);
  db.booking.updateMany.mockResolvedValue({ count: 1 });
});

describe("changeEquipmentRequest and withdrawEquipmentRequest — SCRUM-142", () => {
  it("SCRUM-142 [AC1] TC-142-01: changing only a line's technical requirements says so in the history", async () => {
    await changeEquipmentRequest({
      requestId: "eqr_1",
      lines: [
        { equipmentId: "eqp_mic", quantity: 2, technicalRequirements: "Lapel" },
      ],
    });

    expect(db.equipmentRequestUpdate.create.mock.calls[0][0].data.note).toBe(
      "Changed by the Coordinator: changed the requirements for Microphone.",
    );
    expect(db.equipmentRequestLine.update).toHaveBeenCalledWith({
      where: { id: "eql_mic" },
      data: {
        quantity: 2,
        technicalRequirements: "Lapel",
        suggestedAlternativeId: null,
      },
    });
  });

  it("SCRUM-142 [AC3] TC-142-05: withdrawing a request with nothing reserved records just the withdrawal", async () => {
    expect(await withdrawEquipmentRequest({ requestId: "eqr_1" })).toEqual({
      ok: true,
      data: { id: "eqr_1" },
    });
    expect(db.equipmentRequestUpdate.create.mock.calls[0][0].data.note).toBe(
      "Withdrawn by the Coordinator.",
    );
  });

  it.each([
    [{ requestId: "eqr_1", lines: [] }, "Please fix the highlighted fields."],
    [
      { lines: [{ equipmentId: "eqp_mic", quantity: 1 }] },
      "Please fix the highlighted fields.",
    ],
    [
      { requestId: "eqr_1", lines: [{ equipmentId: "eqp_gone", quantity: 1 }] },
      "Please fix the highlighted fields.",
    ],
  ])(
    "SCRUM-142 [AC1] TC-142-15: an invalid change %j is refused, and nothing is written",
    async (input, error) => {
      expect(await changeEquipmentRequest(input)).toMatchObject({
        ok: false,
        error,
      });
      nothingWritten();
    },
  );

  it("SCRUM-142 [AC3] TC-142-15: a withdrawal with no request id is not found, before anything is read", async () => {
    expect(await withdrawEquipmentRequest({})).toEqual({
      ok: false,
      error: "Equipment request not found.",
    });
    expect(db.equipmentRequest.findUnique).not.toHaveBeenCalled();
  });

  it.each(["SUBMITTED", "REJECTED", "CANCELLED"])(
    "SCRUM-142 [AC5] TC-142-09: a request for a %s event can't be changed or withdrawn",
    async (status) => {
      db.equipmentRequest.findUnique.mockResolvedValue(
        request({ event: event(status) }),
      );

      expect(await withdrawEquipmentRequest({ requestId: "eqr_1" })).toEqual({
        ok: false,
        error:
          "This event isn't being planned, so its requests can't be changed.",
      });
      nothingWritten();
    },
  );

  it("SCRUM-142 [AC7] TC-142-11: an unassigned event's request can't be changed by any Coordinator", async () => {
    db.equipmentRequest.findUnique.mockResolvedValue(
      request({ event: event("PLANNING", null) }),
    );

    expect(
      await changeEquipmentRequest({
        requestId: "eqr_1",
        lines: [{ equipmentId: "eqp_mic", quantity: 1 }],
      }),
    ).toEqual({ ok: false, error: "Equipment request not found." });
    nothingWritten();
  });

  it.each(["TECH_SUPPORT", "VENUE_STAFF", "ORGANISER"] as const)(
    "SCRUM-142 [AC7] TC-142-11: a %s can't change or withdraw a request, and nothing is read",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role, "usr_x"));

      for (const attempt of [
        () => withdrawEquipmentRequest({ requestId: "eqr_1" }),
        () =>
          changeEquipmentRequest({
            requestId: "eqr_1",
            lines: [{ equipmentId: "eqp_mic", quantity: 1 }],
          }),
      ]) {
        expect(await attempt()).toEqual({
          ok: false,
          error: "You do not have permission to do that.",
        });
      }
      expect(db.equipmentRequest.findUnique).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      "change",
      () =>
        changeEquipmentRequest({
          requestId: "eqr_1",
          lines: [{ equipmentId: "eqp_projector", quantity: 1 }],
        }),
    ],
    ["withdrawal", () => withdrawEquipmentRequest({ requestId: "eqr_1" })],
  ])(
    "SCRUM-142 [AC8] TC-142-13: a %s that loses the race to another update writes nothing more",
    async (_, attempt) => {
      db.equipmentRequest.updateMany.mockResolvedValue({ count: 0 });

      expect(await attempt()).toMatchObject({
        ok: false,
        error: expect.stringMatching(
          /^Someone else updated this request first/,
        ),
      });
      expect(db.equipmentRequestUpdate.create).not.toHaveBeenCalled();
      expect(db.reservation.updateMany).not.toHaveBeenCalled();
      expect(db.notification.createMany).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      "change",
      () =>
        changeEquipmentRequest({
          requestId: "eqr_1",
          lines: [{ equipmentId: "eqp_projector", quantity: 1 }],
        }),
    ],
    ["withdrawal", () => withdrawEquipmentRequest({ requestId: "eqr_1" })],
  ])(
    "SCRUM-142 TC-142-15: an unexpected database failure during a %s is not swallowed",
    async (_, attempt) => {
      db.$transaction.mockRejectedValue(new Error("connection lost"));

      await expect(attempt()).rejects.toThrow("connection lost");
    },
  );
});

describe("a Confirm that lands while a change waits for the event lock — SCRUM-142 AC5", () => {
  it.each([
    [
      "change",
      () =>
        changeEquipmentRequest({
          requestId: "eqr_1",
          lines: [{ equipmentId: "eqp_projector", quantity: 1 }],
        }),
    ],
    ["withdrawal", () => withdrawEquipmentRequest({ requestId: "eqr_1" })],
  ])(
    "SCRUM-142 [AC5] TC-142-16: an equipment-request %s is refused once the event is Confirmed under the lock, and nothing is written",
    async (_, attempt) => {
      db.equipmentRequest.findUniqueOrThrow.mockResolvedValue({
        event: { status: "CONFIRMED" },
      });

      expect(await attempt()).toEqual({
        ok: false,
        error:
          "This event is confirmed, so its arrangements change through a change request.",
      });
      expect(db.equipmentRequest.updateMany).not.toHaveBeenCalled();
      expect(db.reservation.updateMany).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-142 [AC5] TC-142-16: a venue-request withdrawal is refused once the event is Confirmed under the lock, and nothing is written", async () => {
    db.booking.findUnique.mockResolvedValue({
      status: "PENDING",
      holdExpiresAt: null,
      venue: { name: "Hall" },
      event: event(),
    });
    db.event.findUniqueOrThrow.mockResolvedValue({ status: "CONFIRMED" });

    expect(await withdrawBookingRequest({ bookingId: "bkg_1" })).toEqual({
      ok: false,
      error:
        "This event is confirmed, so its arrangements change through a change request.",
    });
    expect(db.booking.updateMany).not.toHaveBeenCalled();
  });
});

describe("withdrawBookingRequest — SCRUM-142 AC4", () => {
  const booking = (
    status: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    status,
    holdExpiresAt: null,
    venue: { name: "Hall" },
    event: event(),
    ...overrides,
  });

  beforeEach(() => db.booking.findUnique.mockResolvedValue(booking("PENDING")));

  it("SCRUM-142 [AC4] TC-142-15: a withdrawal with no booking id is not found, before anything is read", async () => {
    expect(await withdrawBookingRequest({})).toEqual({
      ok: false,
      error: "Venue request not found.",
    });
    expect(db.booking.findUnique).not.toHaveBeenCalled();
  });

  it("SCRUM-142 [AC7] TC-142-11: another Coordinator's request, and one that doesn't exist, are not found", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_cara"));
    expect(await withdrawBookingRequest({ bookingId: "bkg_1" })).toEqual({
      ok: false,
      error: "Venue request not found.",
    });
    db.booking.findUnique.mockResolvedValue(null);
    expect(await withdrawBookingRequest({ bookingId: "bkg_missing" })).toEqual({
      ok: false,
      error: "Venue request not found.",
    });
    nothingWritten();
  });

  it.each(["VENUE_STAFF", "ORGANISER"] as const)(
    "SCRUM-142 [AC7] TC-142-11: a %s can't withdraw a venue request",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role, "usr_x"));

      expect(await withdrawBookingRequest({ bookingId: "bkg_1" })).toEqual({
        ok: false,
        error: "You do not have permission to do that.",
      });
      expect(db.booking.findUnique).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-142 [AC5] TC-142-09: a venue request of an event that isn't being planned can't be withdrawn", async () => {
    db.booking.findUnique.mockResolvedValue(
      booking("PENDING", { event: event("REJECTED") }),
    );

    expect(await withdrawBookingRequest({ bookingId: "bkg_1" })).toEqual({
      ok: false,
      error:
        "This event isn't being planned, so its venue requests can't be withdrawn.",
    });
    nothingWritten();
  });

  it.each([
    [
      "REJECTED",
      null,
      /^This request has already been rejected, so it can't be withdrawn\.$/,
    ],
    ["HELD", new Date(Date.now() - 1000), /^This hold expired at /],
    ["EXPIRED", new Date(Date.now() - 1000), /^This hold expired at /],
  ])(
    "SCRUM-142 [AC4, AC8] TC-142-07: a %s request isn't withdrawn, and nothing is written",
    async (status, holdExpiresAt, error) => {
      db.booking.findUnique.mockResolvedValue(
        booking(status, { holdExpiresAt }),
      );

      expect(
        await withdrawBookingRequest({ bookingId: "bkg_1" }),
      ).toMatchObject({
        ok: false,
        error: expect.stringMatching(error),
      });
      nothingWritten();
    },
  );

  it("SCRUM-142 [AC8] TC-142-13: a request decided while being withdrawn keeps that decision, with nothing more written", async () => {
    db.booking.updateMany.mockResolvedValue({ count: 0 });
    db.booking.findUniqueOrThrow.mockResolvedValue({
      status: "APPROVED",
      holdExpiresAt: null,
    });

    expect(await withdrawBookingRequest({ bookingId: "bkg_1" })).toEqual({
      ok: false,
      error:
        "This request has already been approved, so it can't be withdrawn.",
    });
    expect(db.auditLog.create).not.toHaveBeenCalled();
    expect(db.notification.createMany).not.toHaveBeenCalled();
  });

  it("SCRUM-142 TC-142-15: an unexpected database failure is not swallowed", async () => {
    db.$transaction.mockRejectedValue(new Error("connection lost"));

    await expect(
      withdrawBookingRequest({ bookingId: "bkg_1" }),
    ).rejects.toThrow("connection lost");
  });
});
