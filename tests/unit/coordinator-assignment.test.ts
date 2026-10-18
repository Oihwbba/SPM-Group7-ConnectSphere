import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

import {
  getCoordinatorLoads,
  suggestCoordinator,
} from "@/lib/coordinator-assignment";

// SCRUM-165 AC4 — each Coordinator's active-event count and the least-loaded
// suggestion, defined in ONE place (lib/coordinator-assignment.ts). A mocked
// client stands in for Prisma, so no real database is needed.
const db = { user: { findMany: vi.fn() } };
const mockFindMany = db.user.findMany as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
});

function row(id: string, active: number) {
  return { id, name: `Name ${id}`, _count: { coordinatedEvents: active } };
}

describe("getCoordinatorLoads — SCRUM-165 AC4", () => {
  it("SCRUM-165 [AC4] TC-165-05: [Positive] lists every current Coordinator with their number of active events", async () => {
    mockFindMany.mockResolvedValue([row("c1", 3), row("c2", 1)]);

    expect(await getCoordinatorLoads(db as never)).toEqual([
      { id: "c1", name: "Name c1", activeEvents: 3 },
      { id: "c2", name: "Name c2", activeEvents: 1 },
    ]);
  });

  it("SCRUM-165 [AC4] TC-165-05: [Positive] only people who hold the Coordinator role now, and only active events count as load", async () => {
    mockFindMany.mockResolvedValue([]);

    await getCoordinatorLoads(db as never);

    const query = mockFindMany.mock.calls[0][0];
    expect(query.where).toEqual({ role: "COORDINATOR" });
    expect(
      query.select._count.select.coordinatedEvents.where.status.in,
    ).toEqual(["UNDER_REVIEW", "PLANNING", "CONFIRMED"]);
    expect(query.orderBy).toEqual({ createdAt: "asc" });
  });
});

describe("suggestCoordinator — SCRUM-165 AC4", () => {
  const load = (id: string, activeEvents: number) => ({
    id,
    name: id,
    activeEvents,
  });

  it("SCRUM-165 [AC4] TC-165-05: [Positive] suggests the least-loaded Coordinator", () => {
    expect(
      suggestCoordinator([load("c1", 3), load("c2", 1), load("c3", 2)]),
    ).toBe("c2");
  });

  it("SCRUM-165 [AC4] TC-165-05: [Boundary] on a tie, suggests the first listed (the earliest created)", () => {
    expect(suggestCoordinator([load("c1", 1), load("c2", 1)])).toBe("c1");
  });

  it("SCRUM-165 [AC4] TC-165-05: [Boundary] suggests nobody when there are no Coordinators", () => {
    expect(suggestCoordinator([])).toBeNull();
  });
});
