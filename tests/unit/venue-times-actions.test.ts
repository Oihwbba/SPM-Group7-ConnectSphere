import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { changeVenueTimes } from "@/app/(app)/venues/times-actions";
import {
  findTimeClashes,
  flagTimeClashes,
  type TimeClash,
} from "@/lib/venue-time-clashes";

// SCRUM-160 — saving a venue's setup and turnaround time. Test cases:
// docs/testing/SCRUM-160.md. Finding and flagging clashes are tested in
// venue-time-clashes.test.ts, so they are mocked here.

const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  venue: { update: vi.fn() },
  auditLog: { createMany: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/venue-time-clashes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/venue-time-clashes")>()),
  findTimeClashes: vi.fn(),
  flagTimeClashes: vi.fn(),
}));

const mockAuth = auth as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;
const mockFind = findTimeClashes as unknown as Mock;
const mockFlag = flagTimeClashes as unknown as Mock;

function sessionFor(role: Role, id = "usr_staff"): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const at = (hhmm: string) => new Date(`2031-03-10T${hhmm}:00Z`);
const clash: TimeClash = {
  booking: {
    id: "bkg_1",
    status: "APPROVED",
    startAt: at("05:00"),
    endAt: at("07:00"),
    eventId: "evt_1",
    eventName: "Robotics Expo",
    coordinatorId: "usr_coord",
    coordinatorName: "Cody",
    needsReconsideration: false,
    reconsiderationReason: null,
  },
  with: {
    kind: "unavailability",
    id: "una_1",
    startAt: at("04:00"),
    endAt: at("04:45"),
    reason: "MAINTENANCE",
  },
};

const longer = { venueId: "ven_1", setupMinutes: 30, turnaroundMinutes: 45 };

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(sessionFor("VENUE_STAFF"));
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
  tx.$queryRaw.mockResolvedValue([{ setupMinutes: 0, turnaroundMinutes: 0 }]);
  tx.venue.update.mockResolvedValue({ name: "Exhibition Hall" });
  mockFind.mockResolvedValue([]);
  mockFlag.mockResolvedValue(0);
});

function expectNothingSaved() {
  expect(tx.venue.update).not.toHaveBeenCalled();
  expect(tx.auditLog.createMany).not.toHaveBeenCalled();
  expect(mockFlag).not.toHaveBeenCalled();
}

describe("changeVenueTimes — SCRUM-160", () => {
  it("SCRUM-160 [AC1] TC-160-01: lengthening a time that makes bookings clash returns them, unsaved", async () => {
    mockFind.mockResolvedValue([clash]);

    const result = await changeVenueTimes(longer);

    expect(result).toEqual({
      ok: true,
      data: {
        saved: false,
        clashes: [
          {
            bookingId: "bkg_1",
            eventName: "Robotics Expo",
            coordinatorName: "Cody",
            startAt: clash.booking.startAt,
            endAt: clash.booking.endAt,
            clashesWith:
              "unavailability (maintenance) from 10 Mar 2031, 12:00 pm SGT to 10 Mar 2031, 12:45 pm SGT",
          },
        ],
      },
    });
    expect(mockFind).toHaveBeenCalledWith(
      tx,
      "ven_1",
      { setupMinutes: 30, turnaroundMinutes: 45 },
      expect.any(Date),
    );
    expectNothingSaved();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("SCRUM-160 [AC1] TC-160-01: the venue is locked before its times are read", async () => {
    await changeVenueTimes(longer);

    const [sql] = tx.$queryRaw.mock.calls[0];
    expect(sql.join("?")).toContain("FOR NO KEY UPDATE");
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mockFind.mock.invocationCallOrder[0],
    );
  });

  it("SCRUM-160 [AC2, AC3] TC-160-07: once confirmed, the times are saved with who changed them, and the clashing bookings are flagged in the same transaction", async () => {
    mockFind.mockResolvedValue([clash]);
    mockFlag.mockResolvedValue(1);

    const result = await changeVenueTimes({ ...longer, confirmed: true });

    expect(result).toEqual({ ok: true, data: { saved: true, flagged: 1 } });
    expect(tx.venue.update).toHaveBeenCalledWith({
      where: { id: "ven_1" },
      data: { setupMinutes: 30, turnaroundMinutes: 45 },
      select: { name: true },
    });
    expect(tx.auditLog.createMany).toHaveBeenCalledWith({
      data: [
        {
          entityType: "Venue",
          entityId: "ven_1",
          action: "UPDATED",
          actorId: "usr_staff",
          fieldName: "setupMinutes",
          oldValue: "0",
          newValue: "30",
        },
        {
          entityType: "Venue",
          entityId: "ven_1",
          action: "UPDATED",
          actorId: "usr_staff",
          fieldName: "turnaroundMinutes",
          oldValue: "0",
          newValue: "45",
        },
      ],
    });
    expect(mockFlag).toHaveBeenCalledWith(
      tx,
      { name: "Exhibition Hall" },
      [clash],
      "usr_staff",
      expect.any(Date),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/bookings");
    expect(revalidatePath).toHaveBeenCalledWith("/events");
  });

  it("SCRUM-160 [AC6] TC-160-06: lengthening without a clash saves straight away", async () => {
    expect(await changeVenueTimes(longer)).toEqual({
      ok: true,
      data: { saved: true, flagged: 0 },
    });
    expect(tx.venue.update).toHaveBeenCalled();
    expect(mockFlag).toHaveBeenCalledWith(tx, expect.anything(), [], "usr_staff", expect.any(Date));
  });

  it("SCRUM-160 [AC6] TC-160-06: shortening saves without looking for clashes, recording only the time that changed", async () => {
    tx.$queryRaw.mockResolvedValue([{ setupMinutes: 30, turnaroundMinutes: 45 }]);

    const result = await changeVenueTimes({ ...longer, setupMinutes: 15 });

    expect(result).toEqual({ ok: true, data: { saved: true, flagged: 0 } });
    expect(mockFind).not.toHaveBeenCalled();
    expect(tx.auditLog.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ fieldName: "setupMinutes", oldValue: "30", newValue: "15" }),
    ]);
  });

  it("SCRUM-160 [AC7] TC-160-08: saving the same times changes and flags nothing", async () => {
    tx.$queryRaw.mockResolvedValue([{ setupMinutes: 30, turnaroundMinutes: 45 }]);

    expect(await changeVenueTimes({ ...longer, confirmed: true })).toEqual({
      ok: true,
      data: { saved: true, flagged: 0 },
    });
    expect(mockFind).not.toHaveBeenCalled();
    expectNothingSaved();
  });

  it("SCRUM-160 [AC1] TC-160-12: a venue that doesn't exist is refused", async () => {
    tx.$queryRaw.mockResolvedValue([]);

    expect(await changeVenueTimes(longer)).toEqual({ ok: false, error: "Venue not found." });
    expectNothingSaved();
  });

  it("SCRUM-160, SCRUM-159 [AC1] TC-160-12: a time outside 0 to 1,440 whole minutes is refused against its field, before anything is read", async () => {
    const result = await changeVenueTimes({ ...longer, turnaroundMinutes: 1441 });

    expect(result).toEqual({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: {
        turnaroundMinutes: ["Turnaround time must be a whole number of minutes from 0 to 1,440."],
      },
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it.each(["COORDINATOR", "ORGANISER", "TECH_SUPPORT", "ATTENDEE", "SAFETY_OFFICER", "COORDINATOR_LEAD"] as Role[])(
    "SCRUM-160 [AC1] TC-160-12: %s may not change a venue's times",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role));

      expect(await changeVenueTimes(longer)).toEqual({
        ok: false,
        error: "You do not have permission to do that.",
      });
      expect(mockTransaction).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-160: a signed-out visitor is refused", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await changeVenueTimes(longer)).ok).toBe(false);
  });

  it("SCRUM-160: an unexpected database failure propagates", async () => {
    mockTransaction.mockRejectedValue(new Error("connection lost"));
    await expect(changeVenueTimes(longer)).rejects.toThrow("connection lost");
  });
});
