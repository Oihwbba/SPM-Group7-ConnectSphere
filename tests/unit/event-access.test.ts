import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getEventForUser } from "@/app/(app)/events/queries";

// SCRUM-68 — an organiser sees their own events and no one else's, and asking
// for another organiser's event by id must fail IDENTICALLY to asking for one
// that doesn't exist (a null, not a "forbidden"). Session and DB are mocked so
// this stays a fast unit test.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { event: { findUnique: vi.fn() } },
}));

const mockAuth = auth as unknown as Mock;
const mockFind = prisma.event.findUnique as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

// Minimal event row; only the fields the ownership gate reads matter.
function eventRow(
  over: Partial<{
    organiserId: string;
    coordinatorId: string | null;
    status: string;
  }> = {},
) {
  return {
    id: "evt1",
    name: "Annual Tech Summit",
    description: null,
    status: "SUBMITTED",
    startAt: null,
    endAt: null,
    expectedAttendance: null,
    organiserId: "orgA",
    coordinatorId: "coord",
    registrationEnabled: false,
    registrationCapacity: null,
    registrationOpensAt: null,
    registrationClosesAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getEventForUser — SCRUM-68 own-events-only", () => {
  it("SCRUM-68: returns the event to its owning organiser", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "orgA"));
    mockFind.mockResolvedValue(eventRow({ organiserId: "orgA" }));

    const event = await getEventForUser("evt1");

    expect(event?.id).toBe("evt1");
  });

  it("SCRUM-68: returns null for another organiser's event — identical to not-found", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "orgB"));
    mockFind.mockResolvedValue(eventRow({ organiserId: "orgA" }));

    expect(await getEventForUser("evt1")).toBeNull();
  });

  it("SCRUM-68: returns null when the event does not exist (same as above)", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "orgA"));
    mockFind.mockResolvedValue(null);

    expect(await getEventForUser("missing")).toBeNull();
  });

  it("SCRUM-68: hides a draft from everyone but its creator", async () => {
    // A draft has no coordinator, so an otherwise-privileged coordinator
    // must not be able to read it.
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "coord"));
    mockFind.mockResolvedValue(
      eventRow({ status: "DRAFT", coordinatorId: null }),
    );

    expect(await getEventForUser("evt1")).toBeNull();
  });

  it("SCRUM-68: returns a submitted event to its assigned coordinator", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR", "coord"));
    mockFind.mockResolvedValue(eventRow({ coordinatorId: "coord" }));

    expect((await getEventForUser("evt1"))?.id).toBe("evt1");
  });

  it("SCRUM-68: returns null (and never queries) when nobody is signed in", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await getEventForUser("evt1")).toBeNull();
    expect(mockFind).not.toHaveBeenCalled();
  });
});
