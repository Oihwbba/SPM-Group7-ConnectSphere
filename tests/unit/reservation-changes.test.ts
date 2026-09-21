import { describe, it, expect, vi } from "vitest";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { cancelReservation } from "@/app/(app)/equipment/actions";

// SCRUM-32 — modify or cancel a reservation.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { reservation: { delete: vi.fn() } },
}));

describe("cancelReservation — SCRUM-32", () => {
  it("cancels a reservation", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "usr_tech", role: "TECH_SUPPORT", name: "Theo Tech", email: "tech@test.local" },
      expires: "2999-01-01T00:00:00.000Z",
    } as never);
    vi.mocked(prisma.reservation.delete).mockResolvedValue({} as never);

    const result = await cancelReservation("res_1");

    expect(result.ok).toBe(true);
  });
});
