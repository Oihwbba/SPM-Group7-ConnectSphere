import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createDraftEvent } from "./actions";

// The action reaches out to the session and the database; both are mocked so
// this is a fast unit test that never opens a connection. We assert on the
// three outcomes the §6 convention promises: success, validation failure, and
// permission denial.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { event: { create: vi.fn() } },
}));

// `auth` and `prisma.event.create` are heavily overloaded types; casting the
// mocks to a plain Mock keeps the test readable without fighting those
// signatures.
const mockAuth = auth as unknown as Mock;
const mockCreate = prisma.event.create as unknown as Mock;

function sessionFor(role: Role, id: string): Session {
  return {
    user: { id, role, name: "Test User", email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createDraftEvent", () => {
  it("creates a draft owned by the signed-in organiser (happy path)", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));
    // The action selects only { id }, so that is all the mock needs to return.
    mockCreate.mockResolvedValue({ id: "evt_new" });

    const result = await createDraftEvent({
      name: "Annual Tech Summit",
      description: "A day of talks.",
    });

    expect(result).toEqual({ ok: true, data: { id: "evt_new" } });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Annual Tech Summit",
          status: "DRAFT",
          organiserId: "usr_organiser",
        }),
      }),
    );
  });

  it("returns field errors for invalid input and does not touch the database", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER", "usr_organiser"));

    const result = await createDraftEvent({ name: "" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.name).toBeTruthy();
    }
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("denies a user whose role cannot create events", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE", "usr_attendee"));

    const result = await createDraftEvent({ name: "Sneaky Event" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/permission/i);
    }
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
