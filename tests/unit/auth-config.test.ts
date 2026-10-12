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
      expect(token).toEqual({ id: "usr_1", role });

      const signedIn = session({
        session: { user: {}, expires: "2999-01-01T00:00:00.000Z" },
        token,
      });
      expect(signedIn.user).toEqual({ id: "usr_1", role });
    },
  );

  it("SCRUM-172 [AC1] TC-172-01: a value that isn't a role is never put on the token or the session", () => {
    const token = jwt({ token: {}, user: { id: "usr_1", role: "ADMIN" } });
    expect(token).toEqual({ id: "usr_1" });

    const signedIn = session({
      session: { user: {}, expires: "2999-01-01T00:00:00.000Z" },
      token: { id: "usr_1", role: "ADMIN" },
    });
    expect(signedIn.user).toEqual({ id: "usr_1" });
  });
});
