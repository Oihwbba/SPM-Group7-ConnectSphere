import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getEventRegistrations } from "@/app/(app)/events/registration-list-actions";
import { summariseRegistrations } from "@/lib/registration-list";

// SCRUM-70 — an event's registration list for its Organiser and assigned
// Coordinator. `can()` runs for real, so each role's real permissions are
// what's under test.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    registration: { findMany: vi.fn() },
  },
}));

const mockAuth = auth as unknown as Mock;
const mockFindEvent = prisma.event.findUnique as unknown as Mock;
const mockFindRegistrations = prisma.registration.findMany as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const event = {
  organiserId: "usr_organiser",
  coordinatorId: "usr_coordinator",
  status: "CONFIRMED",
  expectedAttendance: 10,
};

const rows = [
  { id: "reg1", status: "REGISTERED", user: { name: "Aria Attendee" } },
  { id: "reg2", status: "WITHDRAWN", user: { name: "Ana Attendee" } },
  { id: "reg3", status: "REGISTERED", user: { name: "Amir Attendee" } },
  { id: "reg4", status: "CANCELLED", user: { name: "Ade Attendee" } },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockFindEvent.mockResolvedValue(event);
  mockFindRegistrations.mockResolvedValue(rows);
});

describe("summariseRegistrations — SCRUM-70 AC3, AC4", () => {
  const list = summariseRegistrations(
    rows.map(({ id, status, user }) => ({
      id,
      status: status as "REGISTERED",
      attendeeName: user.name,
    })),
    10,
  );

  it("SCRUM-70 [AC3] TC-70-05: [Positive] shows the registered count and remaining places", () => {
    expect(list.registeredCount).toBe(2);
    expect(list.capacity).toBe(10);
    expect(list.remaining).toBe(8);
  });

  it("SCRUM-70 [AC3] TC-70-05: [Positive] lists each registration's Attendee name and status", () => {
    expect(list.registered).toEqual([
      { id: "reg1", status: "REGISTERED", attendeeName: "Aria Attendee" },
      { id: "reg3", status: "REGISTERED", attendeeName: "Amir Attendee" },
    ]);
  });

  it("SCRUM-70 [AC4] TC-70-06: [Positive] Withdrawn and Cancelled are shown separately and don't count", () => {
    expect(list.inactive.map((row) => row.status)).toEqual([
      "WITHDRAWN",
      "CANCELLED",
    ]);
    expect(list.registered.map((row) => row.status)).not.toContain("WITHDRAWN");
  });

  it("SCRUM-70 [AC3] TC-70-07: [Boundary] an event with no expected attendance has no places, never a negative number", () => {
    const empty = summariseRegistrations([], null);
    expect(empty).toEqual({
      registeredCount: 0,
      capacity: 0,
      remaining: 0,
      registered: [],
      inactive: [],
    });
  });
});

describe("getEventRegistrations — SCRUM-70", () => {
  it("SCRUM-70 [AC2] TC-70-03: [Positive] the Organiser sees the list for an event they submitted", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

    const result = await getEventRegistrations("evt1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.registeredCount).toBe(2);
      expect(result.data.registered[0].attendeeName).toBe("Aria Attendee");
    }
    expect(mockFindRegistrations).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: "evt1" } }),
    );
  });

  it("SCRUM-70 [AC1] TC-70-01: [Positive] the assigned Coordinator sees the list for their event", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coordinator"));

    expect((await getEventRegistrations("evt1")).ok).toBe(true);
  });

  it("SCRUM-70 [AC2] TC-70-04: [Negative] an Organiser can't see the list for another Organiser's event, and it looks missing", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser_2"));

    expect(await getEventRegistrations("evt1")).toEqual({
      ok: false,
      error: "Event not found.",
    });
    expect(mockFindRegistrations).not.toHaveBeenCalled();
  });

  it("SCRUM-70 [AC1] TC-70-02: [Negative] a Coordinator not assigned to the event can't see its list", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coordinator_2"));

    expect((await getEventRegistrations("evt1")).ok).toBe(false);
    expect(mockFindRegistrations).not.toHaveBeenCalled();
  });

  it("SCRUM-70 [AC1] TC-70-02: [Negative] no Coordinator sees the list of an event with no assigned Coordinator", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_coordinator"));
    mockFindEvent.mockResolvedValue({ ...event, coordinatorId: null });

    expect((await getEventRegistrations("evt1")).ok).toBe(false);
    expect(mockFindRegistrations).not.toHaveBeenCalled();
  });

  it.each([
    "ATTENDEE",
    "VENUE_STAFF",
    "TECH_SUPPORT",
    "COORDINATOR_LEAD",
    "SAFETY_OFFICER",
  ] as const)(
    "SCRUM-70 [AC5, AC7] TC-70-08: [Negative] a %s can't retrieve an event's registration list, before any query runs",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role, "usr_other"));

      expect(await getEventRegistrations("evt1")).toEqual({
        ok: false,
        error: "Event not found.",
      });
      expect(mockFindEvent).not.toHaveBeenCalled();
      expect(mockFindRegistrations).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-70 [AC5] TC-70-10: [Negative] a signed-out caller is refused, before any query runs", async () => {
    mockAuth.mockResolvedValue(null);

    expect((await getEventRegistrations("evt1")).ok).toBe(false);
    expect(mockFindEvent).not.toHaveBeenCalled();
  });

  it("SCRUM-70 [AC2] TC-70-10: [Negative] a missing event is refused the same way as one that isn't yours", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    mockFindEvent.mockResolvedValue(null);

    expect(await getEventRegistrations("evt_missing")).toEqual({
      ok: false,
      error: "Event not found.",
    });
  });
});
