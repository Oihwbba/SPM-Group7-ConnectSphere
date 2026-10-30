import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";

// SCRUM-254 AC4 — the expected attendance is the registration capacity
// (SCRUM-73/74), so the older separate column is no longer read or written.
// It stays until a later migration drops it, so the schema marks it @ignore:
// the client leaves it out of every query, and a build still serving during
// that migration's deploy never selects it.
describe("the old registration capacity column — SCRUM-254 AC4", () => {
  it("SCRUM-254 [AC4] TC-254-04: the database client has no Event.registrationCapacity to read or write", () => {
    expect(Object.keys(Prisma.EventScalarFieldEnum)).not.toContain("registrationCapacity");
    expect(Object.keys(Prisma.EventScalarFieldEnum)).toContain("expectedAttendance");
  });
});
