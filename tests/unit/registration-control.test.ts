import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import type { Session } from "next-auth";
import type { EventStatus, Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  closeRegistration,
  getRegistrationControl,
  reopenRegistration,
} from "@/app/(app)/events/registration-control-actions";
import { formatDateTime } from "@/lib/datetime";

// SCRUM-75 AC6 — the Organiser, or the assigned Coordinator on their behalf,
// closes registration now or reopens it until the event's start. Test cases:
// docs/testing/SCRUM-75.md. Session and database are mocked; the transaction
// runs its callback against a mock `tx`, as in event-confirm.test.ts.

const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  event: { findUnique: vi.fn(), update: vi.fn() },
  registration: { count: vi.fn() },
  auditLog: { create: vi.fn() },
  notification: { updateMany: vi.fn(), createMany: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    registration: { count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const mockAuth = auth as unknown as Mock;
const mockFindUnique = prisma.event.findUnique as unknown as Mock;
const mockCount = prisma.registration.count as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;

const NOW = new Date("2031-05-01T02:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const START = new Date(NOW.getTime() + 7 * 24 * HOUR);

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const organiser = () => sessionFor("ORGANISER", "usr_organiser");
const coordinator = () => sessionFor("COORDINATOR", "usr_coordinator");

function eventRow(
  over: Partial<{
    status: EventStatus;
    organiserId: string;
    coordinatorId: string | null;
    registrationRequired: boolean | null;
    registrationEnabled: boolean;
    registrationOpensAt: Date | null;
    registrationClosesAt: Date | null;
    startAt: Date | null;
  }> = {},
) {
  return {
    name: "Open Day",
    status: "CONFIRMED" as EventStatus,
    organiserId: "usr_organiser",
    coordinatorId: "usr_coordinator" as string | null,
    registrationRequired: true as boolean | null,
    registrationEnabled: true,
    registrationOpensAt: null as Date | null,
    registrationClosesAt: null as Date | null,
    startAt: START as Date | null,
    expectedAttendance: 50,
    ...over,
  };
}

/** Registration that was closed an hour ago, by hand or by its window. */
const closed = () => eventRow({ registrationClosesAt: new Date(NOW.getTime() - HOUR) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mockAuth.mockResolvedValue(organiser());
  tx.event.findUnique.mockResolvedValue(eventRow());
  tx.registration.count.mockResolvedValue(3);
  tx.event.update.mockResolvedValue({});
  tx.auditLog.create.mockResolvedValue({});
  tx.notification.updateMany.mockResolvedValue({ count: 0 });
  tx.notification.createMany.mockResolvedValue({ count: 0 });
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
});

afterEach(() => {
  vi.useRealTimers();
});

function expectNothingWritten() {
  expect(tx.event.update).not.toHaveBeenCalled();
  expect(tx.auditLog.create).not.toHaveBeenCalled();
  expect(tx.notification.updateMany).not.toHaveBeenCalled();
  expect(tx.notification.createMany).not.toHaveBeenCalled();
}

describe("closeRegistration — SCRUM-75 AC6", () => {
  it("SCRUM-75 [AC6] TC-75-06: the Organiser closes open registration, which closes at once and reads as closed", async () => {
    const result = await closeRegistration({ eventId: "evt1" });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        state: "EXPIRED",
        label: "Registration closed",
        registered: 3,
        capacity: 50,
        canClose: false,
        canReopen: true,
      }),
    });
    expect(tx.event.update).toHaveBeenCalledWith({
      where: { id: "evt1" },
      data: { registrationClosesAt: NOW },
    });
  });

  it("SCRUM-75 [AC6] TC-75-06: closing records who closed it, when, and the closing time it replaced", async () => {
    tx.event.findUnique.mockResolvedValue(
      eventRow({ registrationClosesAt: new Date(NOW.getTime() + 24 * HOUR) }),
    );

    await closeRegistration({ eventId: "evt1" });

    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: "Event",
        entityId: "evt1",
        action: "UPDATED",
        actorId: "usr_organiser",
        fieldName: "registrationClosesAt",
        oldValue: new Date(NOW.getTime() + 24 * HOUR).toISOString(),
        newValue: NOW.toISOString(),
      }),
    });
  });

  it("SCRUM-75 [AC6] TC-75-06: closing withdraws the notice still waiting to say registration closed later, and writes no new one", async () => {
    await closeRegistration({ eventId: "evt1" });

    expect(tx.notification.updateMany).toHaveBeenCalledWith({
      where: {
        eventId: "evt1",
        title: "Registration closed",
        withdrawnAt: null,
        showFromAt: { gt: NOW },
      },
      data: { withdrawnAt: NOW },
    });
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });

  it("SCRUM-75 [AC6] TC-75-11: the event row is locked before registration is read, the lock a registration takes", async () => {
    await closeRegistration({ eventId: "evt1" });

    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.event.findUnique.mock.invocationCallOrder[0],
    );
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.registration.count.mock.invocationCallOrder[0],
    );
  });

  it("SCRUM-75 [AC6] TC-75-08: the assigned Coordinator closes it on the Organiser's behalf", async () => {
    mockAuth.mockResolvedValue(coordinator());

    const result = await closeRegistration({ eventId: "evt1" });

    expect(result.ok).toBe(true);
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorId: "usr_coordinator" }),
    });
  });

  it("SCRUM-75 [AC6] TC-75-06: a full event is still open, so it can be closed", async () => {
    tx.registration.count.mockResolvedValue(50);

    const result = await closeRegistration({ eventId: "evt1" });

    expect(result.ok).toBe(true);
    expect(tx.event.update).toHaveBeenCalled();
  });

  it.each([
    ["another Organiser", sessionFor("ORGANISER", "usr_organiser2")],
    ["a Coordinator not assigned to it", sessionFor("COORDINATOR", "usr_coordinator2")],
  ])(
    "SCRUM-75 [AC6] TC-75-08: %s gets the same not found as a missing event, and nothing is written",
    async (_who, session) => {
      mockAuth.mockResolvedValue(session);

      expect(await closeRegistration({ eventId: "evt1" })).toEqual({
        ok: false,
        error: "Event not found.",
      });
      expectNothingWritten();
    },
  );

  it("SCRUM-75 [AC6] TC-75-08: no Coordinator may close registration for an event nobody is assigned to", async () => {
    mockAuth.mockResolvedValue(coordinator());
    tx.event.findUnique.mockResolvedValue(eventRow({ coordinatorId: null }));

    expect(await closeRegistration({ eventId: "evt1" })).toEqual({
      ok: false,
      error: "Event not found.",
    });
    expectNothingWritten();
  });

  it("SCRUM-75 [AC6] TC-75-08: a missing event is not found", async () => {
    tx.event.findUnique.mockResolvedValue(null);

    expect(await closeRegistration({ eventId: "nope" })).toEqual({
      ok: false,
      error: "Event not found.",
    });
    expectNothingWritten();
  });

  it.each([
    ["an Attendee", "ATTENDEE"],
    ["Venue Staff", "VENUE_STAFF"],
  ] as const)(
    "SCRUM-75 [AC6] TC-75-08: %s is refused before anything is read",
    async (_who, role) => {
      mockAuth.mockResolvedValue(sessionFor(role, "usr_other"));

      const result = await closeRegistration({ eventId: "evt1" });

      expect(result.ok).toBe(false);
      expect(mockTransaction).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-75 [AC6] TC-75-08: a signed-out caller is refused", async () => {
    mockAuth.mockResolvedValue(null);

    expect((await closeRegistration({ eventId: "evt1" })).ok).toBe(false);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it.each([
    [
      "the event is in Planning",
      eventRow({ status: "PLANNING" }),
      "Registration can only be closed or reopened while the event is Confirmed.",
    ],
    [
      "the event doesn't need registration (SCRUM-171)",
      eventRow({ registrationRequired: false }),
      "This event doesn't need registration.",
    ],
    [
      "its closing time has passed",
      closed(),
      "Registration is already closed.",
    ],
    [
      "registration was never opened",
      eventRow({ registrationEnabled: false }),
      "Registration is already closed.",
    ],
    [
      "the event has started",
      eventRow({ startAt: NOW }),
      "Registration is already closed.",
    ],
    [
      "registration hasn't opened yet",
      eventRow({ registrationOpensAt: new Date(NOW.getTime() + HOUR) }),
      "Registration hasn't opened yet, so it can't be closed.",
    ],
  ])(
    "SCRUM-75 [AC6] TC-75-09: closing is refused when %s, and nothing is written",
    async (_when, row, message) => {
      tx.event.findUnique.mockResolvedValue(row);

      expect(await closeRegistration({ eventId: "evt1" })).toEqual({
        ok: false,
        error: message,
      });
      expectNothingWritten();
    },
  );

  it("SCRUM-75 [AC6]: a request without an event is refused", async () => {
    const result = await closeRegistration({});

    expect(result.ok).toBe(false);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("SCRUM-75 [AC6]: an unexpected error is rethrown, not reported as a refusal", async () => {
    mockTransaction.mockRejectedValue(new Error("connection lost"));

    await expect(closeRegistration({ eventId: "evt1" })).rejects.toThrow(
      "connection lost",
    );
  });
});

describe("reopenRegistration — SCRUM-75 AC6, AC8, AC9", () => {
  it("SCRUM-75 [AC6] TC-75-07: reopening clears the window, so registration is open until the event's start", async () => {
    tx.event.findUnique.mockResolvedValue(
      eventRow({
        registrationOpensAt: new Date(NOW.getTime() - 48 * HOUR),
        registrationClosesAt: new Date(NOW.getTime() - HOUR),
      }),
    );

    const result = await reopenRegistration({ eventId: "evt1" });

    expect(tx.event.update).toHaveBeenCalledWith({
      where: { id: "evt1" },
      data: {
        registrationEnabled: true,
        registrationOpensAt: null,
        registrationClosesAt: null,
      },
    });
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        state: "OPEN",
        canClose: true,
        canReopen: false,
        period: `Opens on confirmation · Closes ${formatDateTime(START)}`,
      }),
    });
  });

  it("SCRUM-75 [AC6] TC-75-07: reopening is recorded, and a notice is scheduled for when registration now closes, the start", async () => {
    tx.event.findUnique.mockResolvedValue(closed());

    await reopenRegistration({ eventId: "evt1" });

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "usr_organiser",
        fieldName: "registrationClosesAt",
        oldValue: new Date(NOW.getTime() - HOUR).toISOString(),
        newValue: null,
      }),
    });
    expect(tx.notification.createMany).toHaveBeenCalledWith({
      data: ["usr_organiser", "usr_coordinator"].map((userId) => ({
        userId,
        type: "EVENT_STATUS_CHANGED",
        eventId: "evt1",
        title: "Registration closed",
        message: `Registration for "Open Day" closed at ${formatDateTime(START)}.`,
        showFromAt: START,
      })),
    });
  });

  it("SCRUM-75 [AC6] TC-75-08: the assigned Coordinator reopens it on the Organiser's behalf", async () => {
    mockAuth.mockResolvedValue(coordinator());
    tx.event.findUnique.mockResolvedValue(closed());

    expect((await reopenRegistration({ eventId: "evt1" })).ok).toBe(true);
  });

  it("SCRUM-75 [AC6] TC-75-07: registration that was never opened is opened", async () => {
    tx.event.findUnique.mockResolvedValue(eventRow({ registrationEnabled: false }));

    const result = await reopenRegistration({ eventId: "evt1" });

    expect(result.ok && result.data.state).toBe("OPEN");
  });

  it("SCRUM-75 [AC8] TC-75-10: at the event's start it can't be reopened, and nothing is written", async () => {
    tx.event.findUnique.mockResolvedValue(
      eventRow({ registrationClosesAt: new Date(NOW.getTime() - HOUR), startAt: NOW }),
    );

    expect(await reopenRegistration({ eventId: "evt1" })).toEqual({
      ok: false,
      error: "The event has started, so registration can't be reopened.",
    });
    expectNothingWritten();
  });

  it("SCRUM-75 [AC8] TC-75-10: a millisecond before the start it can still be reopened", async () => {
    tx.event.findUnique.mockResolvedValue(
      eventRow({
        registrationClosesAt: new Date(NOW.getTime() - HOUR),
        startAt: new Date(NOW.getTime() + 1),
      }),
    );

    expect((await reopenRegistration({ eventId: "evt1" })).ok).toBe(true);
  });

  it.each([
    ["it is open", eventRow()],
    [
      "it hasn't opened yet",
      eventRow({ registrationOpensAt: new Date(NOW.getTime() + HOUR) }),
    ],
  ])(
    "SCRUM-75 [AC6] TC-75-10: reopening is refused when %s, and nothing is written",
    async (_when, row) => {
      tx.event.findUnique.mockResolvedValue(row);

      expect(await reopenRegistration({ eventId: "evt1" })).toEqual({
        ok: false,
        error: "Registration isn't closed, so it can't be reopened.",
      });
      expectNothingWritten();
    },
  );

  it("SCRUM-75 [AC6] TC-75-08: another Organiser can't reopen it", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser2"));
    tx.event.findUnique.mockResolvedValue(closed());

    expect(await reopenRegistration({ eventId: "evt1" })).toEqual({
      ok: false,
      error: "Event not found.",
    });
    expectNothingWritten();
  });
});

describe("getRegistrationControl — SCRUM-75 AC6", () => {
  beforeEach(() => {
    mockFindUnique.mockResolvedValue(eventRow());
    mockCount.mockResolvedValue(3);
  });

  it("SCRUM-75 [AC6] TC-75-06: the Organiser sees where registration stands and that it can be closed", async () => {
    expect(await getRegistrationControl("evt1")).toEqual({
      ok: true,
      data: {
        state: "OPEN",
        label: "Open",
        period: `Opens on confirmation · Closes ${formatDateTime(START)}`,
        registered: 3,
        capacity: 50,
        canClose: true,
        canReopen: false,
      },
    });
  });

  it("SCRUM-75 [AC6] TC-75-08: the assigned Coordinator sees it too", async () => {
    mockAuth.mockResolvedValue(coordinator());

    expect((await getRegistrationControl("evt1")).ok).toBe(true);
  });

  it.each([
    ["in Planning", eventRow({ status: "PLANNING" })],
    ["that doesn't need registration", eventRow({ registrationRequired: false })],
  ])("SCRUM-75 [AC6]: an event %s has no registration panel", async (_what, row) => {
    mockFindUnique.mockResolvedValue(row);

    expect(await getRegistrationControl("evt1")).toEqual({ ok: true, data: null });
  });

  it.each([
    ["another Organiser", () => mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser2"))],
    ["an Attendee", () => mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"))],
    ["a signed-out caller", () => mockAuth.mockResolvedValue(null)],
    ["a missing event", () => mockFindUnique.mockResolvedValue(null)],
  ])("SCRUM-75 [AC6] TC-75-08: %s gets not found", async (_who, arrange) => {
    arrange();

    expect(await getRegistrationControl("evt1")).toEqual({
      ok: false,
      error: "Event not found.",
    });
    expect(mockCount).not.toHaveBeenCalled();
  });

  it("SCRUM-75 [AC6] TC-75-08: a role that can't control registration is refused before the event is read", async () => {
    mockAuth.mockResolvedValue(sessionFor("VENUE_STAFF", "usr_venuestaff"));

    expect(await getRegistrationControl("evt1")).toEqual({
      ok: false,
      error: "Event not found.",
    });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});
