import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/auth/can";
import {
  getAllEvents,
  getEventForPlanning,
  parseAllEventsFilters,
} from "@/app/(app)/all-events/queries";

// SCRUM-141 — the read-only all-events list. `can()` runs for real so each
// role's actual permissions are under test; the database is mocked.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    event: { findMany: vi.fn(), findUnique: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

const mockAuth = auth as unknown as Mock;
const mockFindMany = prisma.event.findMany as unknown as Mock;
const mockFindUnique = prisma.event.findUnique as unknown as Mock;
const mockUserFindMany = prisma.user.findMany as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

const noFilters = { unassigned: false };
const whereOf = () => mockFindMany.mock.calls[0][0].where;

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
  mockUserFindMany.mockResolvedValue([
    { id: "usr_cody", name: "Cody", _count: { coordinatedEvents: 2 } },
  ]);
});

describe("parseAllEventsFilters — SCRUM-141 AC2", () => {
  it("SCRUM-141 [AC2] TC-141-02: reads a status, a date range, a Coordinator and Unassigned only from the link", () => {
    expect(
      parseAllEventsFilters({
        status: "PLANNING",
        from: "2031-06-01",
        to: "2031-06-30",
        coordinator: "usr_cody",
        unassigned: "1",
      }),
    ).toEqual({
      status: "PLANNING",
      from: "2031-06-01",
      to: "2031-06-30",
      coordinatorId: "usr_cody",
      unassigned: true,
    });
  });

  it("SCRUM-141 [AC1, AC2] TC-141-02: ignores anything malformed, including Draft, rather than refusing the page", () => {
    expect(
      parseAllEventsFilters({
        status: "DRAFT",
        from: "June 1",
        to: ["2031-06-30", "x"],
        coordinator: "",
        unassigned: "yes",
      }),
    ).toEqual({
      status: undefined,
      from: undefined,
      to: "2031-06-30",
      coordinatorId: undefined,
      unassigned: false,
    });
  });
});

describe("parseAllEventsFilters — no filters", () => {
  it("SCRUM-141 [AC1, AC2] TC-141-02: a plain link, or a malformed end date, filters nothing", () => {
    expect(parseAllEventsFilters({})).toEqual({
      status: undefined,
      from: undefined,
      to: undefined,
      coordinatorId: undefined,
      unassigned: false,
    });
    expect(parseAllEventsFilters({ to: "soon" }).to).toBeUndefined();
  });
});

describe("getAllEvents — SCRUM-141", () => {
  it("SCRUM-141 [AC1] TC-141-01: lists every event except Drafts, including unassigned ones, with status, booked venues and Coordinator", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_cody"));

    await getAllEvents(noFilters);

    const query = mockFindMany.mock.calls[0][0];
    expect(query.where).toEqual({ status: { not: "DRAFT" } });
    expect(query.select.coordinator).toEqual({ select: { name: true } });
    expect(query.select.bookings.where).toEqual({ status: "APPROVED" });
    expect(query.select.bookings.select).toEqual({
      venue: { select: { name: true } },
    });
  });

  it("SCRUM-141 [AC2] TC-141-02: sorted by start date", async () => {
    mockAuth.mockResolvedValue(sessionFor("VENUE_STAFF", "usr_vs"));

    await getAllEvents(noFilters);

    expect(mockFindMany.mock.calls[0][0].orderBy).toEqual([
      { startAt: "asc" },
      { name: "asc" },
    ]);
  });

  it("SCRUM-141 [AC2] TC-141-02: filtered by status", async () => {
    mockAuth.mockResolvedValue(sessionFor("TECH_SUPPORT", "usr_ts"));

    await getAllEvents({ ...noFilters, status: "CONFIRMED" });

    expect(whereOf()).toEqual({ status: "CONFIRMED" });
  });

  it("SCRUM-141 [AC2] TC-141-03: a date range covers whole days in Singapore time, both ends included", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_cody"));

    await getAllEvents({ ...noFilters, from: "2031-06-01", to: "2031-06-30" });

    expect(whereOf().startAt).toEqual({
      gte: new Date("2031-05-31T16:00:00.000Z"),
      lt: new Date("2031-06-30T16:00:00.000Z"),
    });
  });

  it("SCRUM-141 [AC2] TC-141-03: one end of the range alone works too", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_cody"));

    await getAllEvents({ ...noFilters, to: "2031-06-30" });
    await getAllEvents({ ...noFilters, from: "2031-06-01" });

    expect(mockFindMany.mock.calls[0][0].where.startAt).toEqual({
      lt: new Date("2031-06-30T16:00:00.000Z"),
    });
    expect(mockFindMany.mock.calls[1][0].where.startAt).toEqual({
      gte: new Date("2031-05-31T16:00:00.000Z"),
    });
  });

  it("SCRUM-141 [AC2] TC-141-04: the Lead can filter by Coordinator", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR_LEAD", "usr_lead"));

    await getAllEvents({ ...noFilters, coordinatorId: "usr_cody" });

    expect(whereOf()).toEqual({
      status: { not: "DRAFT" },
      coordinatorId: "usr_cody",
    });
  });

  it("SCRUM-141 [AC2] TC-141-04: the Lead can show only Unassigned events", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR_LEAD", "usr_lead"));

    await getAllEvents({ ...noFilters, unassigned: true, coordinatorId: "x" });

    expect(whereOf().coordinatorId).toBeNull();
  });

  it("SCRUM-141 [AC2] TC-141-04: the Lead's filters are ignored for anyone else", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_cody"));

    await getAllEvents({ unassigned: true, coordinatorId: "usr_cara" });

    expect(whereOf()).toEqual({ status: { not: "DRAFT" } });
  });

  it("SCRUM-141 [AC5] TC-141-08: the Lead also gets each Coordinator's active events", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR_LEAD", "usr_lead"));

    const result = await getAllEvents(noFilters);

    expect(result?.isLead).toBe(true);
    expect(result?.coordinators).toEqual([
      { id: "usr_cody", name: "Cody", activeEvents: 2 },
    ]);
    expect(
      mockUserFindMany.mock.calls[0][0].select._count.select.coordinatedEvents
        .where.status.in,
    ).toEqual(["UNDER_REVIEW", "PLANNING", "CONFIRMED"]);
  });

  it("SCRUM-141 [AC5] TC-141-08: nobody but the Lead gets the Coordinators' loads", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_cody"));

    const result = await getAllEvents(noFilters);

    expect(result?.isLead).toBe(false);
    expect(result?.coordinators).toEqual([]);
    expect(mockUserFindMany).not.toHaveBeenCalled();
  });

  it.each(["ORGANISER", "ATTENDEE", "SAFETY_OFFICER"] as const)(
    "SCRUM-141 [AC6] TC-141-09: [Negative] a %s can't get the list, before any query runs",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role, "usr_other"));

      expect(await getAllEvents(noFilters)).toBeNull();
      expect(mockFindMany).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-141 [AC6] TC-141-09: [Negative] a signed-out caller can't get the list", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await getAllEvents(noFilters)).toBeNull();
  });
});

describe("getEventForPlanning — SCRUM-141 AC3, AC4", () => {
  const event = {
    id: "evt1",
    name: "Career Fair",
    status: "PLANNING",
    organiserId: "usr_org",
    coordinatorId: "usr_cara",
  };

  it("SCRUM-141 [AC3] TC-141-05: a Coordinator opens an event that isn't theirs read-only: they can't edit it", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_cody"));
    mockFindUnique.mockResolvedValue(event);

    const found = await getEventForPlanning("evt1");

    expect(found?.event).toBe(event);
    expect(found?.canEdit).toBe(false);
    expect(found?.canAssign).toBe(false);
  });

  it("SCRUM-141 [AC3] TC-141-05: its assigned Coordinator is told they can edit it", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_cara"));
    mockFindUnique.mockResolvedValue(event);

    expect((await getEventForPlanning("evt1"))?.canEdit).toBe(true);
  });

  it("SCRUM-141 [AC4] TC-141-07: a Coordinator it was reassigned away from can still open it, read-only", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "usr_cody"));
    mockFindUnique.mockResolvedValue({ ...event, coordinatorId: "usr_cara" });

    const found = await getEventForPlanning("evt1");

    expect(found).not.toBeNull();
    expect(found?.canEdit).toBe(false);
  });

  it("SCRUM-141 [AC3] TC-141-06: for an unassigned Submitted request the Lead's action is assigning", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR_LEAD", "usr_lead"));
    mockFindUnique.mockResolvedValue({
      ...event,
      status: "SUBMITTED",
      coordinatorId: null,
    });

    const found = await getEventForPlanning("evt1");

    expect(found?.canAssign).toBe(true);
    expect(found?.canEdit).toBe(false);
  });

  it("SCRUM-141 [AC3] TC-141-06: the Lead can't assign or edit an event that already has a Coordinator", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR_LEAD", "usr_lead"));
    mockFindUnique.mockResolvedValue(event);

    const found = await getEventForPlanning("evt1");

    expect(found?.canAssign).toBe(false);
    expect(found?.canEdit).toBe(false);
  });

  it.each([null, { ...event, status: "DRAFT" }])(
    "SCRUM-141 [AC1] TC-141-11: [Negative] a missing event or a draft looks not found (%#)",
    async (row) => {
      mockAuth.mockResolvedValue(sessionFor("VENUE_STAFF", "usr_vs"));
      mockFindUnique.mockResolvedValue(row);

      expect(await getEventForPlanning("evt1")).toBeNull();
    },
  );

  it.each(["ORGANISER", "ATTENDEE", "SAFETY_OFFICER"] as const)(
    "SCRUM-141 [AC6] TC-141-09: [Negative] a %s can't open an event here, before any query runs",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role, "usr_org"));

      expect(await getEventForPlanning("evt1")).toBeNull();
      expect(mockFindUnique).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-141 [AC6] TC-141-09: [Negative] a signed-out caller can't open an event here", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await getEventForPlanning("evt1")).toBeNull();
  });
});

describe("can — event:view-all (SCRUM-141)", () => {
  it("SCRUM-141 [AC1, AC6] TC-141-09: only Coordinators, the Lead, Venue Staff and Technical Support may view every event", () => {
    const allowed: Role[] = [
      "COORDINATOR",
      "COORDINATOR_LEAD",
      "VENUE_STAFF",
      "TECH_SUPPORT",
    ];
    for (const role of [
      ...allowed,
      "ORGANISER",
      "ATTENDEE",
      "SAFETY_OFFICER",
    ] as Role[]) {
      expect(can({ id: "u", role }, "event:view-all")).toBe(
        allowed.includes(role),
      );
    }
  });

  it("SCRUM-141 [AC3] TC-141-05: viewing every event never lets a Coordinator edit one that isn't theirs", () => {
    expect(
      can({ id: "usr_cody", role: "COORDINATOR" }, "event:edit", {
        kind: "event",
        organiserId: "usr_org",
        coordinatorId: "usr_cara",
        status: "PLANNING",
      }),
    ).toBe(false);
  });
});
