import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  registerForEvent,
  withdrawRegistration,
} from "@/app/(app)/events/registration-actions";

// SCRUM-73/74 — the register action. The transaction runs its callback
// against a mock `tx`, same convention as clarification.test.ts and
// event-status.test.ts: $queryRaw stands in for the FOR UPDATE lock,
// event/registration calls for the typed reads and the write.
const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  event: { findUniqueOrThrow: vi.fn() },
  registration: {
    findUnique: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
  },
  notification: { createMany: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { $transaction: vi.fn() },
}));

const mockAuth = auth as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

function eventRow(
  over: Partial<{
    expectedAttendance: number | null;
    registrationEnabled: boolean;
    registrationOpensAt: Date | null;
    registrationClosesAt: Date | null;
    startAt: Date | null;
  }> = {},
) {
  return {
    expectedAttendance: 100,
    registrationEnabled: true,
    registrationOpensAt: null,
    registrationClosesAt: null,
    startAt: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tx.$queryRaw.mockResolvedValue([{ id: "evt1" }]);
  tx.event.findUniqueOrThrow.mockResolvedValue(eventRow());
  tx.registration.findUnique.mockResolvedValue(null);
  tx.registration.count.mockResolvedValue(0);
  tx.registration.upsert.mockResolvedValue({ id: "reg1" });
  tx.registration.updateMany.mockResolvedValue({ count: 1 });
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
});

describe("registerForEvent — SCRUM-73", () => {
  it("[Positive] AC: registering creates a REGISTERED registration for the caller", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));

    const result = await registerForEvent({ eventId: "evt1" });

    expect(result).toEqual({ ok: true, data: { id: "reg1" } });
    expect(tx.registration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId_userId: { eventId: "evt1", userId: "usr_attendee" } },
        create: {
          eventId: "evt1",
          userId: "usr_attendee",
          status: "REGISTERED",
        },
      }),
    );
  });

  it("[Positive] AC: registers with the fields SCRUM-73's own text names — no separate capacity value read", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));

    await registerForEvent({ eventId: "evt1" });

    expect(tx.event.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ expectedAttendance: true }),
      }),
    );
  });

  it("[Positive] re-registering after a withdrawal flips the SAME row rather than inserting a second one", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    tx.registration.findUnique.mockResolvedValue({ status: "WITHDRAWN" });

    const result = await registerForEvent({ eventId: "evt1" });

    expect(result.ok).toBe(true);
    expect(tx.registration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "REGISTERED",
          withdrawnAt: null,
        }),
      }),
    );
  });

  it("[Negative] AC: the same Attendee cannot hold two active registrations for the same event", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    tx.registration.findUnique.mockResolvedValue({ status: "REGISTERED" });

    const result = await registerForEvent({ eventId: "evt1" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/already registered/i);
    expect(tx.registration.upsert).not.toHaveBeenCalled();
  });

  it("[Negative] AC: registration is refused for an event that is not Confirmed", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    tx.$queryRaw.mockResolvedValue([]); // the locking query's WHERE status='CONFIRMED' matched nothing

    const result = await registerForEvent({ eventId: "evt1" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not open for registration/i);
    expect(tx.event.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(tx.registration.upsert).not.toHaveBeenCalled();
  });

  it("[Negative] AC: registration is refused when registrationEnabled is false", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    tx.event.findUniqueOrThrow.mockResolvedValue(
      eventRow({ registrationEnabled: false }),
    );

    const result = await registerForEvent({ eventId: "evt1" });

    expect(result.ok).toBe(false);
    expect(tx.registration.upsert).not.toHaveBeenCalled();
  });

  it("[Negative] SCRUM-74 AC: a full event refuses a direct registration request and creates nothing", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    tx.event.findUniqueOrThrow.mockResolvedValue(
      eventRow({ expectedAttendance: 5 }),
    );
    tx.registration.count.mockResolvedValue(5);

    const result = await registerForEvent({ eventId: "evt1" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/full/i);
    expect(tx.registration.upsert).not.toHaveBeenCalled();
  });

  it("[Negative] SCRUM-74 AC: registration is accepted with capacity remaining, decreasing it by exactly one", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    tx.event.findUniqueOrThrow.mockResolvedValue(
      eventRow({ expectedAttendance: 5 }),
    );
    tx.registration.count.mockResolvedValue(4); // one remaining place

    const result = await registerForEvent({ eventId: "evt1" });

    expect(result.ok).toBe(true);
    expect(tx.registration.upsert).toHaveBeenCalledTimes(1);
  });

  it("[Negative] a not-yet-open registration period is refused", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    tx.event.findUniqueOrThrow.mockResolvedValue(
      eventRow({ registrationOpensAt: new Date("2999-01-01") }),
    );

    const result = await registerForEvent({ eventId: "evt1" });

    expect(result.ok).toBe(false);
    expect(tx.registration.upsert).not.toHaveBeenCalled();
  });

  it("[Negative] an expired registration period is refused", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    tx.event.findUniqueOrThrow.mockResolvedValue(
      eventRow({ registrationClosesAt: new Date("2000-01-01") }),
    );

    const result = await registerForEvent({ eventId: "evt1" });

    expect(result.ok).toBe(false);
    expect(tx.registration.upsert).not.toHaveBeenCalled();
  });

  it("[Positive] AC2: places are first come, first served — the registration is REGISTERED at once, with no approval step", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    tx.event.findUniqueOrThrow.mockResolvedValue(
      eventRow({ expectedAttendance: 1 }),
    );

    const result = await registerForEvent({ eventId: "evt1" });

    expect(result.ok).toBe(true);
    expect(tx.registration.upsert.mock.calls[0][0].create.status).toBe(
      "REGISTERED",
    );
  });

  it("[Negative] AC5 / SCRUM-75 AC8: registration is refused once the event has started, even with no window set", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    tx.event.findUniqueOrThrow.mockResolvedValue(
      eventRow({ startAt: new Date("2000-01-01") }),
    );

    const result = await registerForEvent({ eventId: "evt1" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not currently open/i);
    expect(tx.registration.upsert).not.toHaveBeenCalled();
  });

  it("[Positive] AC5: the event's start is read inside the lock, so the start cut-off is enforced server-side", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));

    await registerForEvent({ eventId: "evt1" });

    expect(tx.event.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ startAt: true }),
      }),
    );
  });

  it("[Negative] AC7: an event back in Planning refuses new registrations and leaves existing ones untouched", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    tx.$queryRaw.mockResolvedValue([]); // status is PLANNING, not CONFIRMED

    const result = await registerForEvent({ eventId: "evt1" });

    expect(result.ok).toBe(false);
    expect(tx.registration.upsert).not.toHaveBeenCalled();
    expect(tx.registration.updateMany).not.toHaveBeenCalled();
  });

  it("[Negative] AC: registration is refused for validation failure (missing eventId)", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));

    const result = await registerForEvent({ eventId: "" });

    expect(result.ok).toBe(false);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("[Security gate] a role without registration:create (e.g. ORGANISER) is refused before the transaction runs", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

    const result = await registerForEvent({ eventId: "evt1" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/permission/i);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("[Negative] a signed-out caller is refused", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await registerForEvent({ eventId: "evt1" });

    expect(result.ok).toBe(false);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("[Exit path] rethrows an unexpected (non-permission) error instead of swallowing it", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    mockTransaction.mockRejectedValueOnce(new Error("DB unavailable"));

    await expect(registerForEvent({ eventId: "evt1" })).rejects.toThrow(
      "DB unavailable",
    );
  });
});

describe("withdrawRegistration — SCRUM-74/77 (minimal slice)", () => {
  it("[Positive] SCRUM-74 AC: withdrawing a REGISTERED registration flips it to WITHDRAWN", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    tx.registration.findUnique.mockResolvedValue({
      id: "reg1",
      eventId: "evt1",
      userId: "usr_attendee",
      status: "REGISTERED",
    });

    const result = await withdrawRegistration({ registrationId: "reg1" });

    expect(result).toEqual({ ok: true, data: { id: "reg1" } });
    expect(tx.registration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "reg1", status: "REGISTERED" },
        data: expect.objectContaining({ status: "WITHDRAWN" }),
      }),
    );
  });

  it("[Positive] SCRUM-74 AC: withdrawal locks the Event row before writing, so a concurrent registration for the freed place cannot interleave", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    tx.registration.findUnique.mockResolvedValue({
      id: "reg1",
      eventId: "evt1",
      userId: "usr_attendee",
      status: "REGISTERED",
    });

    await withdrawRegistration({ registrationId: "reg1" });

    expect(tx.$queryRaw).toHaveBeenCalled();
  });

  it("[Positive] withdrawing an already-WITHDRAWN registration is a no-op — idempotent, no lock taken", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    tx.registration.findUnique.mockResolvedValue({
      id: "reg1",
      eventId: "evt1",
      userId: "usr_attendee",
      status: "WITHDRAWN",
    });

    const result = await withdrawRegistration({ registrationId: "reg1" });

    expect(result).toEqual({ ok: true, data: { id: "reg1" } });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.registration.updateMany).not.toHaveBeenCalled();
  });

  it("[Positive] ADR 0006: the write is self-guarding — a stale read of REGISTERED still only claims a row still REGISTERED, so it cannot clobber a status changed in the meantime", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    tx.registration.findUnique.mockResolvedValue({
      id: "reg1",
      eventId: "evt1",
      userId: "usr_attendee",
      status: "REGISTERED",
    });
    // Simulates the row having moved on by the time the write runs (e.g. a
    // concurrent transition claimed it first): zero rows matched.
    tx.registration.updateMany.mockResolvedValue({ count: 0 });

    const result = await withdrawRegistration({ registrationId: "reg1" });

    expect(result).toEqual({ ok: true, data: { id: "reg1" } });
    expect(tx.registration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "reg1", status: "REGISTERED" } }),
    );
  });

  it("[Negative] SCRUM-70 AC6: not-found parity: an Attendee cannot withdraw another Attendee's registration", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    tx.registration.findUnique.mockResolvedValue({
      id: "reg1",
      eventId: "evt1",
      userId: "usr_someone_else",
      status: "REGISTERED",
    });

    const result = await withdrawRegistration({ registrationId: "reg1" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not found/i);
    expect(tx.registration.updateMany).not.toHaveBeenCalled();
  });

  it("[Negative] a non-existent registration id is refused the same way as someone else's", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    tx.registration.findUnique.mockResolvedValue(null);

    const result = await withdrawRegistration({ registrationId: "reg1" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not found/i);
  });

  it("[Negative] AC: withdrawal is refused for validation failure (missing registrationId)", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));

    const result = await withdrawRegistration({ registrationId: "" });

    expect(result.ok).toBe(false);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("[Security gate] a role without registration:withdraw (e.g. ORGANISER) is refused before the transaction runs", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

    const result = await withdrawRegistration({ registrationId: "reg1" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/permission/i);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("[Negative] a signed-out caller is refused", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await withdrawRegistration({ registrationId: "reg1" });

    expect(result.ok).toBe(false);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("[Exit path] rethrows an unexpected (non-permission) error instead of swallowing it", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    mockTransaction.mockRejectedValueOnce(new Error("DB unavailable"));

    await expect(
      withdrawRegistration({ registrationId: "reg1" }),
    ).rejects.toThrow("DB unavailable");
  });
});

describe("registration notices — SCRUM-45 AC11, AC13", () => {
  const people = {
    name: "Gala",
    organiserId: "usr_org",
    coordinatorId: "usr_coord",
  };
  const recipients = () =>
    tx.notification.createMany.mock.calls.map((call) =>
      call[0].data.map((n: { userId: string; title: string }) => [
        n.userId,
        n.title,
      ]),
    );

  it("SCRUM-45 [AC11] TC-45-06: the registration that takes the last place tells the Organiser and the Coordinator", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    tx.event.findUniqueOrThrow.mockResolvedValue({ ...eventRow(), ...people });
    tx.registration.count.mockResolvedValue(99);

    await registerForEvent({ eventId: "evt1" });

    expect(recipients()).toEqual([
      [
        ["usr_org", "Registration is full"],
        ["usr_coord", "Registration is full"],
      ],
    ]);
  });

  it("SCRUM-45 [AC11] TC-45-06: a registration that leaves a place open writes no notice", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    tx.event.findUniqueOrThrow.mockResolvedValue({ ...eventRow(), ...people });
    tx.registration.count.mockResolvedValue(98);

    await registerForEvent({ eventId: "evt1" });

    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });

  describe("withdrawing", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
      tx.registration.findUnique.mockResolvedValue({
        id: "reg1",
        eventId: "evt1",
        userId: "usr_attendee",
        status: "REGISTERED",
      });
    });

    it("SCRUM-45 [AC11] TC-45-06: withdrawing from a full event tells the Organiser and the Coordinator a place opened", async () => {
      tx.event.findUniqueOrThrow.mockResolvedValue({
        id: "evt1",
        expectedAttendance: 100,
        ...people,
      });
      tx.registration.count.mockResolvedValue(100);

      await withdrawRegistration({ registrationId: "reg1" });

      expect(recipients()).toEqual([
        [
          ["usr_org", "A place opened at a full event"],
          ["usr_coord", "A place opened at a full event"],
        ],
      ]);
    });

    it.each([
      ["the event wasn't full", 100, 99, 1],
      ["the registration was withdrawn a moment earlier", 100, 100, 0],
      ["the event has no capacity set", null, 0, 1],
    ])(
      "SCRUM-45 [AC11, AC13] TC-45-06: no notice when %s",
      async (_, expectedAttendance, active, claimed) => {
        tx.event.findUniqueOrThrow.mockResolvedValue({
          id: "evt1",
          expectedAttendance,
          ...people,
        });
        tx.registration.count.mockResolvedValue(active);
        tx.registration.updateMany.mockResolvedValue({ count: claimed });

        await withdrawRegistration({ registrationId: "reg1" });

        expect(tx.notification.createMany).not.toHaveBeenCalled();
      },
    );
  });
});
