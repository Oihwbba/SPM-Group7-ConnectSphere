import { describe, it, expect } from "vitest";
import type { Role } from "@prisma/client";

import { NAV_BY_ROLE, LANDING_ROUTE_BY_ROLE, ROLE_LABEL } from "@/lib/nav";

// SCRUM-66 — each role is shown only the functions its role allows, and lands
// on the right page. The nav map is the single source of truth (adding a role
// or changing what one sees is a change here, not on every screen), so pinning
// it here proves the story without rendering anything.
const ROLES: Role[] = [
  "ORGANISER",
  "COORDINATOR",
  "VENUE_STAFF",
  "TECH_SUPPORT",
  "ATTENDEE",
];

function hrefsFor(role: Role): string[] {
  return NAV_BY_ROLE[role].map((item) => item.href);
}

describe("role-based navigation — SCRUM-66", () => {
  it("lands every role on a page that is in its own nav", () => {
    for (const role of ROLES) {
      expect(hrefsFor(role)).toContain(LANDING_ROUTE_BY_ROLE[role]);
    }
  });

  it("keeps venue, equipment and booking work out of an organiser's nav", () => {
    const hrefs = hrefsFor("ORGANISER");
    expect(hrefs).not.toContain("/venues");
    expect(hrefs).not.toContain("/equipment");
    expect(hrefs).not.toContain("/bookings");
  });

  it("shows each internal role its own work", () => {
    expect(hrefsFor("VENUE_STAFF")).toContain("/bookings");
    expect(hrefsFor("TECH_SUPPORT")).toContain("/equipment");
    expect(hrefsFor("COORDINATOR")).toContain("/venues");
  });

  it("gives an attendee only their events and registrations", () => {
    const hrefs = hrefsFor("ATTENDEE");
    expect(hrefs).toContain("/events");
    expect(hrefs).toContain("/registrations");
    expect(hrefs).not.toContain("/venues");
    expect(hrefs).not.toContain("/equipment");
  });

  it("gives every role a human-readable label for the header", () => {
    for (const role of ROLES) {
      expect(ROLE_LABEL[role]).toBeTruthy();
    }
  });
});
