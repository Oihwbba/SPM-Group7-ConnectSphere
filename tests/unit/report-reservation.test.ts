import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { can } from "@/lib/auth/can";
import {
  REPORT_REASON_REQUIRED,
  reportReservationSchema,
} from "@/lib/schemas/reservation";
import { reportUnprovidableReservation } from "@/app/(app)/equipment/actions";

// SCRUM-32 — Technical Support report reserved equipment that can no longer
// be provided, with the database mocked: what a report writes, and every
// refusal. The same rules against a real Postgres, including two reports at
// once and the Coordinator's resolution, are in
// tests/integration/report-reservation.test.ts. Test cases:
// docs/testing/SCRUM-32.md.
const db = vi.hoisted(() => ({
  reservation: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateManyAndReturn: vi.fn(),
  },
  booking: { updateManyAndReturn: vi.fn() },
  event: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  notification: { create: vi.fn(), createMany: vi.fn() },
  auditLog: { create: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = auth as unknown as Mock;
const sessionFor = (role: Role, id = `usr_${role.toLowerCase()}`): Session => ({
  user: { id, role, name: "Test User", email: `${id}@test.local` },
  expires: "2999-01-01T00:00:00.000Z",
});
const TECH = sessionFor("TECH_SUPPORT", "usr_tech");
const REASON = "Two of the projectors failed their safety test.";
const report = (reason = REASON) =>
  reportUnprovidableReservation({ reservationId: "rsv_1", reason });

const flaggedRow = {
  id: "rsv_1",
  eventId: "evt_1",
  quantity: 2,
  equipment: { type: "Projector" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(TECH);
  db.$transaction.mockImplementation((cb: (tx: typeof db) => unknown) => cb(db));
  db.reservation.findUnique.mockResolvedValue({
    eventId: "evt_1",
    status: "CONFIRMED",
    needsReconsideration: false,
  });
  db.reservation.updateManyAndReturn.mockResolvedValue([flaggedRow]);
  db.booking.updateManyAndReturn.mockResolvedValue([]);
  db.event.findMany.mockResolvedValue([
    { id: "evt_1", name: "Expo", coordinatorId: "usr_coord" },
  ]);
  db.user.findMany.mockResolvedValue([{ id: "usr_tech" }, { id: "usr_tech2" }]);
});

function expectNothingWritten() {
  expect(db.reservation.updateManyAndReturn).not.toHaveBeenCalled();
  expect(db.auditLog.create).not.toHaveBeenCalled();
  expect(db.notification.create).not.toHaveBeenCalled();
  expect(db.notification.createMany).not.toHaveBeenCalled();
}

describe("reportUnprovidableReservation — SCRUM-32", () => {
  it("SCRUM-32 [AC1, AC4] TC-32-01: a report flags the reservation with the reason, and changes nothing else about it", async () => {
    expect(await report()).toEqual({ ok: true, data: { reservationId: "rsv_1" } });

    const { where, data } = db.reservation.updateManyAndReturn.mock.calls[0][0];
    expect(where).toEqual({
      id: { in: ["rsv_1"] },
      status: "CONFIRMED",
      needsReconsideration: false,
    });
    expect(data).toEqual({
      needsReconsideration: true,
      reconsiderationFlaggedAt: expect.any(Date),
      reconsiderationReason: `Technical Support can no longer provide it: ${REASON}`,
      reconsiderationResolvedAt: null,
      reconsiderationResolvedById: null,
    });
    // AC4: it stays reserved, with its quantity and period.
    for (const field of ["status", "quantity", "startAt", "endAt", "cancelledAt"]) {
      expect(data).not.toHaveProperty(field);
    }
    expect(revalidatePath).toHaveBeenCalledWith("/equipment");
    expect(revalidatePath).toHaveBeenCalledWith("/events");
  });

  it("SCRUM-32 [AC2, AC5] TC-32-01: the event's Coordinator is told, with the reason", async () => {
    await report();

    expect(db.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "usr_coord",
        eventId: "evt_1",
        type: "ARRANGEMENT_FLAGGED",
        title: "Arrangements flagged for reconsideration",
        message: `Projector × 2 for "Expo" needs reconsideration. Technical Support can no longer provide it: ${REASON}`,
      },
    });
  });

  it("SCRUM-32 [AC5] TC-32-01: the report is recorded with who made it and when", async () => {
    await report();

    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        entityType: "Reservation",
        entityId: "rsv_1",
        action: "REPORTED_UNPROVIDABLE",
        actorId: "usr_tech",
        fieldName: "needsReconsideration",
        oldValue: "false",
        newValue: "true",
        summary: REASON,
      },
    });
  });

  it("SCRUM-32 [AC1] TC-32-01: the event's row is locked before the reservation's, the order resolving a flag uses", async () => {
    await report();

    const [lock] = db.$queryRaw.mock.calls[0] as [TemplateStringsArray];
    expect(lock.join("?")).toContain('FROM "Event" WHERE "id" = ? FOR KEY SHARE');
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.reservation.updateManyAndReturn.mock.invocationCallOrder[0],
    );
  });

  it.each(["", "   "])(
    "SCRUM-32 [AC2] TC-32-02: a report without a reason (%j) is refused before anything is read",
    async (reason) => {
      expect(await report(reason)).toEqual({
        ok: false,
        error: REPORT_REASON_REQUIRED,
        fieldErrors: { reason: [REPORT_REASON_REQUIRED] },
      });
      expect(db.reservation.findUnique).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it("SCRUM-32 [AC2] TC-32-02: a reason over 500 characters is refused, and one of exactly 500 is accepted", () => {
    const parse = (reason: string) =>
      reportReservationSchema.safeParse({ reservationId: "rsv_1", reason }).success;
    expect(parse("x".repeat(500))).toBe(true);
    expect(parse("x".repeat(501))).toBe(false);
  });

  it("SCRUM-32 [AC1] TC-32-02: a request without a reservation id is not found, before anything is read", async () => {
    expect(await reportUnprovidableReservation({ reason: REASON })).toEqual({
      ok: false,
      error: "Reservation not found.",
      fieldErrors: { reservationId: ["Required"] },
    });
    expect(db.reservation.findUnique).not.toHaveBeenCalled();
  });

  it("SCRUM-32 [AC3] TC-32-03: a reservation already flagged is left alone, and nobody is told again", async () => {
    db.reservation.findUnique.mockResolvedValue({
      eventId: "evt_1",
      status: "CONFIRMED",
      needsReconsideration: true,
    });

    expect(await report()).toEqual({
      ok: false,
      error:
        "This reservation has already been reported and is waiting for its event's Coordinator to decide.",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("SCRUM-32 [AC3] TC-32-03: a reservation someone else reported a moment earlier is flagged once, with no second record", async () => {
    db.reservation.updateManyAndReturn.mockResolvedValue([]);
    db.reservation.findUniqueOrThrow.mockResolvedValue({ status: "CONFIRMED" });

    expect(await report()).toMatchObject({
      ok: false,
      error: expect.stringContaining("already been reported"),
    });
    expect(db.auditLog.create).not.toHaveBeenCalled();
    expect(db.notification.create).not.toHaveBeenCalled();
  });

  it("SCRUM-32 [AC1] TC-32-04: a reservation cancelled a moment earlier is not found, and nothing is recorded", async () => {
    db.reservation.updateManyAndReturn.mockResolvedValue([]);
    db.reservation.findUniqueOrThrow.mockResolvedValue({ status: "CANCELLED" });

    expect(await report()).toEqual({ ok: false, error: "Reservation not found." });
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it.each([null, { eventId: "evt_1", status: "CANCELLED", needsReconsideration: false }])(
    "SCRUM-32 [AC1] TC-32-04: a reservation that doesn't exist or is cancelled (%j) is not found",
    async (row) => {
      db.reservation.findUnique.mockResolvedValue(row);

      expect(await report()).toEqual({ ok: false, error: "Reservation not found." });
      expectNothingWritten();
    },
  );

  it.each(["COORDINATOR", "VENUE_STAFF", "ORGANISER", "SAFETY_OFFICER"] as Role[])(
    "SCRUM-32 [AC4] TC-32-05: %s can't report a reservation, and nothing is read",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role));

      expect(await report()).toEqual({
        ok: false,
        error: "You do not have permission to do that.",
      });
      expect(db.reservation.findUnique).not.toHaveBeenCalled();
      expectNothingWritten();
    },
  );

  it("SCRUM-32 [AC4] TC-32-05: only Technical Support hold the permission to report", () => {
    expect(can({ id: "u", role: "TECH_SUPPORT" }, "reservation:report")).toBe(true);
    for (const role of ["COORDINATOR", "VENUE_STAFF", "ORGANISER", "ATTENDEE"] as Role[]) {
      expect(can({ id: "u", role }, "reservation:report")).toBe(false);
    }
  });

  it("SCRUM-32 TC-32-05: a signed-out caller is refused", async () => {
    mockAuth.mockResolvedValue(null);

    expect((await report()).ok).toBe(false);
    expect(db.reservation.findUnique).not.toHaveBeenCalled();
  });

  it("SCRUM-32: an unexpected database failure is not swallowed", async () => {
    db.$transaction.mockRejectedValue(new Error("connection lost"));

    await expect(report()).rejects.toThrow("connection lost");
  });
});
