import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

import { prisma } from "@/lib/db";
import { CoordinatorEvents } from "@/app/(app)/events/role-views";
import { can } from "@/lib/auth/can";

// SCRUM-17 — "Only Event Coordinators and the request's own Organiser can
// view a request's details." The Organiser side of this is covered
// elsewhere (User Story 84's tests in events.test.ts). This file covers the
// Coordinator side: CoordinatorEvents' query is the actual access gate for
// what a Coordinator's list — and from it, the details modal — can ever
// show, so this calls the REAL function rather than re-typing its query.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    event: { findMany: vi.fn() },
  },
}));
const mockFindMany = prisma.event.findMany as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
});

describe("CoordinatorEvents — SCRUM-17 access scope", () => {
  it("[Positive] AC, SCRUM-165 [AC8] TC-165-11: queries only the events assigned to this coordinator", async () => {
    await CoordinatorEvents({ coordinatorId: "usr_coord" });

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { coordinatorId: "usr_coord" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("[Positive] the fetched events and isCoordinator flag are passed to the client list", async () => {
    const events = [{ id: "evt1", name: "Career Fair", status: "SUBMITTED" }];
    mockFindMany.mockResolvedValue(events);

    const result = await CoordinatorEvents({ coordinatorId: "usr_coord" });

    expect(result.props.events).toBe(events);
    expect(result.props.isCoordinator).toBe(true);
  });

  it("[Negative] AC/SCRUM-68 parity: the query's OR condition matches can()'s relationship rule exactly for an event assigned to a DIFFERENT coordinator", () => {
    // This event would NOT be returned by the query above (its coordinatorId
    // is neither "usr_coord" nor null), and can() independently agrees it is
    // not viewable by usr_coord — the two must never disagree, or a
    // coordinator could see something the query excluded (or vice versa).
    const eventAssignedElsewhere = {
      kind: "event" as const,
      organiserId: "usr_org",
      coordinatorId: "usr_other_coord",
      status: "UNDER_REVIEW" as const,
    };

    expect(
      can({ id: "usr_coord", role: "COORDINATOR" }, "event:read", eventAssignedElsewhere),
    ).toBe(false);
  });

  it("[Negative] SCRUM-165 [AC8] TC-165-11: an unclaimed Submitted event is not viewable by a coordinator; it waits in the Lead's queue", () => {
    const unclaimedSubmitted = {
      kind: "event" as const,
      organiserId: "usr_org",
      coordinatorId: null,
      status: "SUBMITTED" as const,
    };

    expect(
      can({ id: "usr_coord", role: "COORDINATOR" }, "event:read", unclaimedSubmitted),
    ).toBe(false);
  });

  it("[Boundary] AC/SCRUM-68 parity: an unclaimed DRAFT is NOT viewable — the query explicitly excludes DRAFT from the null-coordinator branch", () => {
    const unclaimedDraft = {
      kind: "event" as const,
      organiserId: "usr_org",
      coordinatorId: null,
      status: "DRAFT" as const,
    };

    expect(
      can({ id: "usr_coord", role: "COORDINATOR" }, "event:read", unclaimedDraft),
    ).toBe(false);
  });
});