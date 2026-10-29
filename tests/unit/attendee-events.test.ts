import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getBrowsableEvent } from "@/app/(app)/events/queries";
import { getBrowsableEvents } from "@/app/(app)/events/role-views";

// SCRUM-72 — browsing is role-gated (event:browse), not ownership-gated: any
// Attendee may see any Confirmed, non-Cancelled event. `can()` runs for real
// here (it needs no mock, unlike the session/DB layer) so each role's actual
// permission table is what's under test, not a stand-in for it.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    event: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));

const mockAuth = auth as unknown as Mock;
const mockFindUnique = prisma.event.findUnique as unknown as Mock;
const mockFindMany = prisma.event.findMany as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

function eventRow(
  over: Partial<{
    status: string;
    registrationRequired: boolean | null;
    confirmedStartAt: Date | null;
    registrations: { id: string; status: string }[];
  }> = {},
) {
  return {
    id: "evt1",
    name: "Career Fair",
    description: "Annual careers fair.",
    status: "CONFIRMED",
    startAt: new Date("2031-06-01T02:00:00Z"),
    endAt: new Date("2031-06-01T10:00:00Z"),
    timezone: "Asia/Singapore",
    expectedAttendance: 100,
    registrationEnabled: true,
    registrationOpensAt: null,
    registrationClosesAt: null,
    bookings: [],
    registrations: [] as { id: string; status: string }[],
    // SCRUM-85: never confirmed before, unless a case says otherwise.
    confirmedStartAt: null as Date | null,
    _count: { registrations: 0 },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getBrowsableEvent — SCRUM-72 attendee detail read", () => {
  it("SCRUM-162 [AC7] TC-162-11: the detail read brings every approved venue's name and location, in the order requested", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    mockFindUnique.mockResolvedValue(eventRow());

    await getBrowsableEvent("evt1");

    const { bookings } = mockFindUnique.mock.calls[0][0].include;
    expect(bookings).toEqual({
      where: { status: "APPROVED" },
      orderBy: { createdAt: "asc" },
      include: { venue: { select: { name: true, location: true } } },
    });
  });

  it("SCRUM-72: [Positive] an Attendee can load a Confirmed event by id", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    mockFindUnique.mockResolvedValue(eventRow());

    const result = await getBrowsableEvent("evt1");

    expect(result?.id).toBe("evt1");
  });

  it.each([
    ["Yes", true],
    ["not answered (requested before the choice existed)", null],
  ])(
    "SCRUM-171 [AC4] TC-171-06: an event whose Registration needed is %s can be opened by its URL",
    async (_, registrationRequired) => {
      mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
      mockFindUnique.mockResolvedValue(eventRow({ registrationRequired }));

      expect((await getBrowsableEvent("evt1"))?.id).toBe("evt1");
    },
  );

  it("SCRUM-171 [AC4] TC-171-06: an event that doesn't need registration can't be opened by its URL — the same null as a missing one", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    mockFindUnique.mockResolvedValue(eventRow({ registrationRequired: false }));

    expect(await getBrowsableEvent("evt1")).toBeNull();
  });

  it("SCRUM-85 [AC9, AC10] TC-85-07: an Attendee registered for an event back in Planning after being Confirmed can open it", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    mockFindUnique.mockResolvedValue(
      eventRow({
        status: "PLANNING",
        confirmedStartAt: new Date("2031-06-01T02:00:00Z"),
        registrations: [{ id: "reg1", status: "REGISTERED" }],
      }),
    );

    expect((await getBrowsableEvent("evt1"))?.id).toBe("evt1");
  });

  it.each([
    ["not registered", []],
    ["whose registration was withdrawn", [{ id: "reg1", status: "WITHDRAWN" }]],
  ])(
    "SCRUM-85 [AC5, AC9] TC-85-07: an Attendee %s can't open an event being re-planned — the same null as a missing one",
    async (_, registrations) => {
      mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
      mockFindUnique.mockResolvedValue(
        eventRow({
          status: "PLANNING",
          confirmedStartAt: new Date("2031-06-01T02:00:00Z"),
          registrations,
        }),
      );

      expect(await getBrowsableEvent("evt1")).toBeNull();
    },
  );

  it("SCRUM-72 [AC7] TC-72-06: [Negative] a non-Confirmed event (e.g. Planning) is not browsable — same null as missing", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    mockFindUnique.mockResolvedValue(eventRow({ status: "PLANNING" }));

    expect(await getBrowsableEvent("evt1")).toBeNull();
  });

  it("SCRUM-72 [AC7] TC-72-06: [Negative] a Cancelled event is not browsable", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    mockFindUnique.mockResolvedValue(eventRow({ status: "CANCELLED" }));

    expect(await getBrowsableEvent("evt1")).toBeNull();
  });

  it("SCRUM-72 [AC8] TC-72-07: [Negative] a missing id returns null without distinguishing it from a not-yet-visible one", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
    mockFindUnique.mockResolvedValue(null);

    expect(await getBrowsableEvent("evt_missing")).toBeNull();
  });

  it("SCRUM-72 [AC8] TC-72-07: [Security gate] a role without event:browse (e.g. VENUE_STAFF) is refused before the query even runs", async () => {
    mockAuth.mockResolvedValue(sessionFor("VENUE_STAFF", "usr_venuestaff"));

    const result = await getBrowsableEvent("evt1");

    expect(result).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("SCRUM-72 [AC8] TC-72-07: [Negative] a signed-out caller is refused", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await getBrowsableEvent("evt1")).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it.each([
    "DRAFT",
    "SUBMITTED",
    "UNDER_REVIEW",
    "APPROVED",
    "PLANNING",
    "COMPLETED",
    "CANCELLED",
    "REJECTED",
  ])(
    "SCRUM-72 [AC7, AC8]: [Negative] opening a %s event directly returns the same null as a missing one",
    async (status) => {
      mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));
      mockFindUnique.mockResolvedValue(eventRow({ status }));

      expect(await getBrowsableEvent("evt1")).toBeNull();
    },
  );

  it.each(["ORGANISER", "COORDINATOR", "VENUE_STAFF", "TECH_SUPPORT"] as const)(
    "SCRUM-72 [AC8]: [Security gate] a %s opening a Confirmed event's attendee URL gets null, before the query runs",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role, "usr_other"));
      mockFindUnique.mockResolvedValue(eventRow());

      expect(await getBrowsableEvent("evt1")).toBeNull();
      expect(mockFindUnique).not.toHaveBeenCalled();
    },
  );
});

describe("getBrowsableEvents — SCRUM-72 browse list", () => {
  it("SCRUM-171 [AC4] TC-171-06, SCRUM-72 [AC1, AC2] TC-72-01: [Positive] queries only CONFIRMED events that take registrations, ordered by start date", async () => {
    mockFindMany.mockResolvedValue([eventRow()]);

    const events = await getBrowsableEvents("usr_attendee");

    expect(events).toHaveLength(1);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "CONFIRMED",
          // SCRUM-171 AC4: only events that take registrations.
          OR: [{ registrationRequired: true }, { registrationRequired: null }],
        },
        orderBy: { startAt: "asc" },
      }),
    );
  });

  it("SCRUM-162 [AC7] TC-162-11, SCRUM-72 [AC1, AC2] TC-72-01: [Positive] fetches every approved booking's venue, the caller's own registration, and the active-registration count for each event", async () => {
    mockFindMany.mockResolvedValue([]);

    await getBrowsableEvents("usr_attendee");

    const call = mockFindMany.mock.calls[0][0];
    expect(call.include.bookings.where).toEqual({ status: "APPROVED" });
    // SCRUM-162 AC7: every approved venue, not just one.
    expect(call.include.bookings).not.toHaveProperty("take");
    expect(call.include.bookings.orderBy).toEqual({ createdAt: "asc" });
    expect(call.include.bookings.include.venue.select).toEqual({
      name: true,
      location: true,
    });
    expect(call.include.registrations.where).toEqual({
      userId: "usr_attendee",
    });
    expect(call.include._count.select.registrations.where).toEqual({
      status: "REGISTERED",
    });
  });
});
