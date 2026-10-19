import { describe, it, expect } from "vitest";
import type { Role } from "@prisma/client";

import { authConfig } from "@/auth.config";

// SCRUM-172 AC1 — "users can hold the Event Coordinator Lead and Safety
// Officer roles". The sign-in callbacks copy the role onto the JWT and then
// the session only if it is a known role, and they listed only the five
// Release 1 roles, so a Lead or Safety Officer signed in with no role.
type Callback = (params: Record<string, unknown>) => Record<string, unknown>;
const jwt = authConfig.callbacks.jwt as unknown as Callback;
const session = authConfig.callbacks.session as unknown as Callback;

const ROLES: Role[] = [
  "ORGANISER",
  "COORDINATOR",
  "VENUE_STAFF",
  "TECH_SUPPORT",
  "ATTENDEE",
  "COORDINATOR_LEAD",
  "SAFETY_OFFICER",
];

describe("sign-in callbacks — SCRUM-172 AC1", () => {
  it.each(ROLES)(
    "SCRUM-172 [AC1] TC-172-01: a %s keeps its role on the token and the session",
    (role) => {
      const token = jwt({ token: {}, user: { id: "usr_1", role } });
      expect(token).toEqual({ id: "usr_1", role, additionalRoles: [] });

      const signedIn = session({
        session: { user: {}, expires: "2999-01-01T00:00:00.000Z" },
        token,
      });
      expect(signedIn.user).toEqual({ id: "usr_1", role, additionalRoles: [] });
    },
  );

  it("SCRUM-172 [AC1] TC-172-01: a value that isn't a role is never put on the token or the session", () => {
    const token = jwt({ token: {}, user: { id: "usr_1", role: "ADMIN" } });
    expect(token).toEqual({ id: "usr_1", additionalRoles: [] });

    const signedIn = session({
      session: { user: {}, expires: "2999-01-01T00:00:00.000Z" },
      token: { id: "usr_1", role: "ADMIN" },
    });
    expect(signedIn.user).toEqual({ id: "usr_1", additionalRoles: [] });
  });
});

// SCRUM-121 AC1 — an account can hold more than one role: the roles it holds
// besides its primary one ride on the token and the session too. Test cases:
// docs/testing/SCRUM-121.md.
describe("sign-in callbacks — SCRUM-121 AC1", () => {
  it("SCRUM-121 [AC1] TC-121-01: an account's additional roles are kept on the token and the session", () => {
    const token = jwt({
      token: {},
      user: { id: "usr_1", role: "COORDINATOR", additionalRoles: ["ORGANISER", "VENUE_STAFF"] },
    });
    expect(token).toEqual({
      id: "usr_1",
      role: "COORDINATOR",
      additionalRoles: ["ORGANISER", "VENUE_STAFF"],
    });

    const signedIn = session({
      session: { user: {}, expires: "2999-01-01T00:00:00.000Z" },
      token,
    });
    expect(signedIn.user).toEqual({
      id: "usr_1",
      role: "COORDINATOR",
      additionalRoles: ["ORGANISER", "VENUE_STAFF"],
    });
  });

  it("SCRUM-121 [AC1] TC-121-01: a value that isn't a role is dropped from the additional roles, and a token without them gives none", () => {
    expect(
      jwt({ token: {}, user: { id: "usr_1", role: "ORGANISER", additionalRoles: ["ADMIN", "ATTENDEE"] } }),
    ).toEqual({ id: "usr_1", role: "ORGANISER", additionalRoles: ["ATTENDEE"] });

    expect(
      session({
        session: { user: {}, expires: "2999-01-01T00:00:00.000Z" },
        token: { id: "usr_1", role: "ORGANISER", additionalRoles: ["ATTENDEE", "ADMIN"] },
      }).user,
    ).toEqual({ id: "usr_1", role: "ORGANISER", additionalRoles: ["ATTENDEE"] });
    expect(
      session({
        session: { user: {}, expires: "2999-01-01T00:00:00.000Z" },
        token: { id: "usr_1", role: "ORGANISER" },
      }).user,
    ).toEqual({ id: "usr_1", role: "ORGANISER", additionalRoles: [] });
  });

  it("SCRUM-121 [AC1] TC-121-01: a token written before this change, with no additional roles, signs in with none", () => {
    expect(jwt({ token: { id: "usr_1", role: "ORGANISER" } })).toEqual({ id: "usr_1", role: "ORGANISER" });
  });
});
