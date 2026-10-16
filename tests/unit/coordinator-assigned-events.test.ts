import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

import { prisma } from "@/lib/db";
import { getCoordinatorEvents } from "@/app/(app)/events/role-views";
import { filterAndSortEvents } from "@/app/(app)/events/events-client";
import { can } from "@/lib/auth/can";

// SCRUM-69 — a Coordinator's default event list. The query runs for real
// against a mocked Prisma; `can()` runs for real so the list and the access
// rule are checked against each other, not against a copy of either.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { event: { findMany: vi.fn() } },
}));
const mockFindMany = prisma.event.findMany as unknown as Mock;

const cody = { id: "usr_coordinator", role: "COORDINATOR" as const };
const cara = { id: "usr_coordinator_2", role: "COORDINATOR" as const };

function eventFor(coordinatorId: string | null, status = "UNDER_REVIEW") {
  return {
    kind: "event" as const,
    organiserId: "usr_organiser",
    coordinatorId,
    status: status as "UNDER_REVIEW",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
});

// SCRUM-165 supersedes SCRUM-69 AC1 and AC4: an unassigned request no longer
// shows in every Coordinator's list; it waits in the Lead's queue.
describe("SCRUM-69 — View only the events assigned to me", () => {
  it("[Positive] AC1, SCRUM-165 [AC8]: my list is exactly the events assigned to me", async () => {
    await getCoordinatorEvents(cody.id);

    expect(mockFindMany.mock.calls[0][0].where).toEqual({
      coordinatorId: cody.id,
    });
  });

  it("[Positive] AC1: an event assigned to me is one I can open", () => {
    expect(can(cody, "event:read", eventFor(cody.id))).toBe(true);
  });

  it("[Negative] AC1: an event assigned to another Coordinator is neither listed nor openable", async () => {
    await getCoordinatorEvents(cody.id);

    expect(mockFindMany.mock.calls[0][0].where).not.toEqual({
      coordinatorId: cara.id,
    });
    expect(can(cody, "event:read", eventFor(cara.id))).toBe(false);
  });

  it("[Negative] AC1: an unassigned draft is not in any Coordinator's list", () => {
    expect(can(cody, "event:read", eventFor(null, "DRAFT"))).toBe(false);
  });

  it("[Positive] AC3: after a handover the event leaves my list and is in the new Coordinator's", async () => {
    const handedOver = eventFor(cara.id);

    await getCoordinatorEvents(cody.id);
    await getCoordinatorEvents(cara.id);

    expect(mockFindMany.mock.calls[0][0].where).toEqual({
      coordinatorId: cody.id,
    });
    expect(mockFindMany.mock.calls[1][0].where).toEqual({
      coordinatorId: cara.id,
    });
    expect(can(cody, "event:read", handedOver)).toBe(false);
    expect(can(cara, "event:read", handedOver)).toBe(true);
  });

  it("[Negative] SCRUM-165 [AC8] (supersedes AC4): a Submitted event with no Coordinator is in no Coordinator's list; it waits for the Lead", () => {
    const unassigned = eventFor(null, "SUBMITTED");

    for (const coordinator of [cody, cara]) {
      expect(can(coordinator, "event:read", unassigned)).toBe(false);
    }
  });
});

describe("SCRUM-69 AC2: the list is searched, filtered and sorted like My Event Requests", () => {
  const events = [
    {
      name: "Career Fair",
      status: "UNDER_REVIEW",
      purpose: "Recruitment",
      startAt: "2031-06-03T02:00:00Z",
    },
    {
      name: "Alumni Homecoming",
      status: "SUBMITTED",
      purpose: "Reunion",
      startAt: "2031-06-01T02:00:00Z",
    },
    {
      name: "Charity Gala",
      status: "PLANNING",
      purpose: "Fundraising",
      startAt: "2031-06-02T02:00:00Z",
    },
  ];

  it("[Positive] AC2: searching by name keeps only matching events, ignoring case", () => {
    expect(
      filterAndSortEvents(events, { searchQuery: "GALA" }).map((e) => e.name),
    ).toEqual(["Charity Gala"]);
  });

  it("[Positive] AC2: filtering by status keeps only that status", () => {
    expect(
      filterAndSortEvents(events, { statusFilter: "PLANNING" }).map(
        (e) => e.name,
      ),
    ).toEqual(["Charity Gala"]);
  });

  it("[Positive] AC2: the Awaiting review tab keeps the events a Coordinator can still decide", () => {
    expect(
      filterAndSortEvents(events, {
        activeTab: "SUBMITTED",
        submittedMeans: "awaiting-review",
        sortField: "name",
        sortOrder: "asc",
      }).map((e) => e.name),
    ).toEqual(["Alumni Homecoming", "Career Fair"]);
  });

  it("[Positive] AC2: sorting by start date orders by proposed date", () => {
    expect(
      filterAndSortEvents(events, {
        sortField: "startAt",
        sortOrder: "asc",
      }).map((e) => e.name),
    ).toEqual(["Alumni Homecoming", "Charity Gala", "Career Fair"]);
  });
});
