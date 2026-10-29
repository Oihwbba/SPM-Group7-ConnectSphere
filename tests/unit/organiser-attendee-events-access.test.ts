import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

import { prisma } from "@/lib/db";
import { OrganiserEvents, AttendeeEvents } from "@/app/(app)/events/role-views";

// The Organiser and Attendee counterparts to
// tests/unit/coordinator-events-access.test.ts's CoordinatorEvents coverage —
// same technique (call the real async component as a plain function, assert
// on the query it ran and the props it handed to its client component),
// closing the gap those two never had a dedicated test for.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    event: { findMany: vi.fn() },
    clarificationRequest: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
const mockFindMany = prisma.event.findMany as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
  vi.mocked(prisma.clarificationRequest.findMany).mockResolvedValue([]);
});

describe("OrganiserEvents — the reference feature's own-events scope", () => {
  it("SCRUM-68 [AC1, AC5] TC-68-01: [Positive] queries only events owned by this organiser, newest-updated first", async () => {
    await OrganiserEvents({ organiserId: "usr_organiser" });

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { organiserId: "usr_organiser", discardedAt: null },
      orderBy: { updatedAt: "desc" },
    });
  });

  it("[Positive] the fetched events are passed to the client list, with no coordinator flag", async () => {
    const events = [
      { id: "evt1", name: "Annual Tech Summit", status: "DRAFT" },
    ];
    mockFindMany.mockResolvedValue(events);

    const result = await OrganiserEvents({ organiserId: "usr_organiser" });

    expect(result.props.events).toBe(events);
    expect(result.props.isCoordinator).toBeFalsy();
  });
});

describe("AttendeeEvents — SCRUM-72 browse list", () => {
  it("SCRUM-171 [AC4] TC-171-06: [Positive] queries only Confirmed events, earliest-starting first", async () => {
    await AttendeeEvents({ attendeeId: "usr_attendee" });

    const call = mockFindMany.mock.calls[0][0];
    expect(call.where).toEqual({
      status: "CONFIRMED",
      // SCRUM-171 AC4: only events that take registrations.
      OR: [{ registrationRequired: true }, { registrationRequired: null }],
    });
    expect(call.orderBy).toEqual({ startAt: "asc" });
  });

  it("SCRUM-72: [Positive] scopes the caller's own registration row to the given attendeeId", async () => {
    await AttendeeEvents({ attendeeId: "usr_attendee" });

    const call = mockFindMany.mock.calls[0][0];
    expect(call.include.registrations.where).toEqual({
      userId: "usr_attendee",
    });
  });

  it("SCRUM-72: [Positive] the fetched events are passed to the attendee client list", async () => {
    const events = [{ id: "evt1", name: "Career Fair", status: "CONFIRMED" }];
    mockFindMany.mockResolvedValue(events);

    const result = await AttendeeEvents({ attendeeId: "usr_attendee" });

    expect(result.props.events).toBe(events);
  });
});
