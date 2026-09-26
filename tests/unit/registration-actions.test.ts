import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { registerForEvent } from "@/app/(app)/events/registration-actions";

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
  },
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
  }> = {},
) {
  return {
    expectedAttendance: 100,
    registrationEnabled: true,
    registrationOpensAt: null,
    registrationClosesAt: null,
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
