import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getMyRegistrations } from "@/app/(app)/registrations/queries";
import { shownRegistrationStatus } from "@/app/(app)/registrations/registrations-list";

// SCRUM-76 — the Attendee's own registration list. `can()` runs for real so
// each role's actual permission table is under test.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { registration: { findMany: vi.fn() } },
}));

const mockAuth = auth as unknown as Mock;
const mockFindMany = prisma.registration.findMany as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
});

describe("getMyRegistrations — SCRUM-76", () => {
  it("SCRUM-76 [AC5] TC-76-04: [Positive] the list contains only my registrations — filtered by the session's user id", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));

    await getMyRegistrations();

    expect(mockFindMany.mock.calls[0][0].where).toEqual({
      userId: "usr_attendee",
    });
  });

  it("SCRUM-76 [AC1] TC-76-01: [Positive] fetches the event name, date, time, venue and the registration status", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));

    await getMyRegistrations();

    const { select } = mockFindMany.mock.calls[0][0];
    expect(select.status).toBe(true);
    expect(select.event.select).toEqual(
      expect.objectContaining({
        name: true,
        startAt: true,
        endAt: true,
        status: true,
      }),
    );
    expect(select.event.select.bookings.where).toEqual({ status: "APPROVED" });
    expect(select.event.select.bookings.select.venue.select).toEqual({
      name: true,
      location: true,
    });
  });

  it("SCRUM-162 [AC7], SCRUM-85 [AC8] TC-85-06: every approved venue is read, in the order requested, with what was last confirmed for an event being re-planned", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));

    await getMyRegistrations();

    const { select } = mockFindMany.mock.calls[0][0].select.event;
    expect(select.bookings.orderBy).toEqual({ createdAt: "asc" });
    expect(select.bookings).not.toHaveProperty("take");
    expect(select).toMatchObject({
      status: true,
      confirmedStartAt: true,
      confirmedEndAt: true,
      confirmedVenues: true,
    });
  });

  it("SCRUM-76 [AC4] TC-76-03: [Positive] event details are read live from the event, not from a copy on the registration", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));

    await getMyRegistrations();

    const { select } = mockFindMany.mock.calls[0][0];
    expect(Object.keys(select).sort()).toEqual(["event", "id", "status"]);
  });

  it("SCRUM-76 [AC1, AC2] TC-76-01: [Positive] lists the soonest event first", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));

    await getMyRegistrations();

    expect(mockFindMany.mock.calls[0][0].orderBy).toEqual({
      event: { startAt: "asc" },
    });
  });

  it.each(["ORGANISER", "COORDINATOR", "VENUE_STAFF", "TECH_SUPPORT"] as const)(
    "SCRUM-76: [Security gate] a %s without registration:read gets an empty list, before the query runs",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role, "usr_other"));

      expect(await getMyRegistrations()).toEqual([]);
      expect(mockFindMany).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-76 [AC5] TC-76-04: [Negative] a signed-out caller gets an empty list, before the query runs", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await getMyRegistrations()).toEqual([]);
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

describe("shownRegistrationStatus — SCRUM-76 AC2, AC3", () => {
  it.each(["REGISTERED", "WITHDRAWN", "CANCELLED"] as const)(
    "SCRUM-76 [AC2]: [Positive] a %s registration on a Confirmed event shows its own status",
    (status) => {
      expect(shownRegistrationStatus(status, "CONFIRMED")).toBe(status);
    },
  );

  it.each(["REGISTERED", "WITHDRAWN", "CANCELLED"] as const)(
    "SCRUM-85 [AC3, AC4, AC5, AC12] TC-85-09: [Positive] given ConnectSphere cancels the event, a %s registration shows as Cancelled",
    (status) => {
      expect(shownRegistrationStatus(status, "CANCELLED")).toBe("CANCELLED");
    },
  );

  it("SCRUM-73 [AC7] TC-73-07: [Boundary] an event back in Planning keeps the registration's own status", () => {
    expect(shownRegistrationStatus("REGISTERED", "PLANNING")).toBe(
      "REGISTERED",
    );
  });
});
