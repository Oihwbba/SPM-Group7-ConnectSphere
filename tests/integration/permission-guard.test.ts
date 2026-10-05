import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterAll,
  type Mock,
} from "vitest";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createDraftEvent } from "@/app/(app)/events/actions";

// SCRUM-67 — "attempt a forbidden action directly, bypassing the UI, and
// confirm it is refused AND that nothing in the database changed. Then confirm
// a permitted action still works."
//
// This is an INTEGRATION test: it calls the real Server Action against the real
// (seeded) database and mocks ONLY the session. So "nothing changed" is proven
// by an actual row count before and after — not by a mock's memory. It needs a
// migrated + seeded database (CI provides one; locally use the Docker DB).
//
// It WRITES (creates, then deletes, an Event). Prisma loads `.env` on import,
// and the team's `.env` points at the shared Supabase database — so the suite
// only runs against a localhost database and skips itself everywhere else.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
const mockAuth = auth as unknown as Mock;

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

// Deterministic seed ids (prisma/seed.ts). createDraftEvent writes
// organiserId = the session user's id, which must be a real User row (FK), so
// we sign in as actual seeded users rather than inventing ids.
const SEED_USER: Record<Role, string> = {
  ORGANISER: "usr_organiser",
  COORDINATOR: "usr_coordinator",
  VENUE_STAFF: "usr_venuestaff",
  TECH_SUPPORT: "usr_techsupport",
  ATTENDEE: "usr_attendee",
};

function sessionFor(role: Role): Session {
  const id = SEED_USER[role];
  return {
    user: { id, role, name: role, email: `${id}@test.local` },
    expires: "2999-01-01T00:00:00.000Z",
  };
}

// Only ORGANISER holds "event:create"; every other role must be refused.
const FORBIDDEN_ROLES: Role[] = [
  "COORDINATOR",
  "VENUE_STAFF",
  "TECH_SUPPORT",
  "ATTENDEE",
];

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe.skipIf(!usesLocalDatabase)("SCRUM-67 — createDraftEvent is guarded for every role", () => {
  it.each(FORBIDDEN_ROLES)(
    "refuses %s directly and leaves the database unchanged",
    async (role) => {
      mockAuth.mockResolvedValue(sessionFor(role));

      // Counted by the attempt's own name: other suites running in parallel
      // create and remove events of their own.
      const name = `Bypass attempt by ${role}`;
      const before = await prisma.event.count({ where: { name } });
      const result = await createDraftEvent({
        name,
        description: "Should never be written.",
      });
      const after = await prisma.event.count({ where: { name } });

      // Refused, with a message that does not leak what the resource is.
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/permission/i);
      }

      // Nothing was written.
      expect(after).toBe(before);
    },
  );

  it("still lets an ORGANISER create a draft (the permitted path works)", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER"));

    const name = `SCRUM-67 guard check ${Date.now()}`;
    const before = await prisma.event.count({ where: { name } });
    const result = await createDraftEvent({ name });
    const after = await prisma.event.count({ where: { name } });

    expect(result.ok).toBe(true);
    expect(after).toBe(before + 1);

    // Keep the suite idempotent — remove the row we just created.
    if (result.ok) {
      await prisma.event.delete({ where: { id: result.data.id } });
    }
  });
});
