import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";

// SCRUM-253 AC4 — the free-text hours from before SCRUM-34 are no longer read
// or written. The column stays until a later migration drops it, so the
// schema marks it @ignore: the client leaves it out of every query, and a
// build still serving during that migration's deploy never selects it.
describe("the old free-text hours — SCRUM-253 AC4", () => {
  it("SCRUM-253 [AC4] TC-253-07: the database client has no Venue.operatingHours to read or write", () => {
    expect(Object.keys(Prisma.VenueScalarFieldEnum)).not.toContain("operatingHours");
    expect(Object.keys(Prisma.VenueScalarFieldEnum)).toContain("name");
  });
});
