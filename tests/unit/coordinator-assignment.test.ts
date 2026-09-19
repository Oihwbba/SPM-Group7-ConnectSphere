import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { pickCoordinator } from "@/lib/coordinator-assignment";

// SCRUM-20 — the fairness rule lives in ONE place (lib/coordinator-assignment.ts).
// These tests exercise that function directly, with a mocked "tx" standing in
// for the Prisma transaction client, so no real database is needed.
const tx = {
  $executeRaw: vi.fn(),
  user: { findMany: vi.fn() },
};

const mockFindMany = tx.user.findMany as unknown as Mock;
const mockExecuteRaw = tx.$executeRaw as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pickCoordinator — SCRUM-20 fairness rule", () => {
  it("AC: picks the coordinator with the fewest active events", async () => {
    mockFindMany.mockResolvedValue([
      { id: "coord_busy", _count: { coordinatedEvents: 5 } },
      { id: "coord_free", _count: { coordinatedEvents: 1 } },
      { id: "coord_mid", _count: { coordinatedEvents: 3 } },
    ]);

    const result = await pickCoordinator(tx as never);

    expect(result).toBe("coord_free");
  });

  it("AC: no coordinators available — returns null rather than throwing, so the caller can still reach SUBMITTED", async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await pickCoordinator(tx as never);

    expect(result).toBeNull();
  });

  it("AC: only counts ACTIVE events as load, not terminal ones (COMPLETED/CANCELLED/REJECTED excluded by the query)", async () => {
    // This asserts the query itself filters correctly — the mock stands in
    // for what the database would already have excluded.
    mockFindMany.mockResolvedValue([{ id: "coord_1", _count: { coordinatedEvents: 0 } }]);

    await pickCoordinator(tx as never);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          _count: expect.objectContaining({
            select: expect.objectContaining({
              coordinatedEvents: expect.objectContaining({
                where: {
                  status: { in: ["UNDER_REVIEW", "APPROVED", "PLANNING", "CONFIRMED"] },
                },
              }),
            }),
          }),
        }),
      }),
    );
  });

  it("AC: takes the assignment lock BEFORE reading load, so a concurrent submission counts this one's assignment", async () => {
    mockFindMany.mockResolvedValue([{ id: "coord_1", _count: { coordinatedEvents: 0 } }]);

    await pickCoordinator(tx as never);

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    expect(mockExecuteRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mockFindMany.mock.invocationCallOrder[0],
    );
  });

  it("Boundary: a single coordinator is always picked, regardless of their load", async () => {
    mockFindMany.mockResolvedValue([
      { id: "coord_only", _count: { coordinatedEvents: 42 } },
    ]);

    const result = await pickCoordinator(tx as never);

    expect(result).toBe("coord_only");
  });
});