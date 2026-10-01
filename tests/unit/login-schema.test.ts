import { describe, it, expect } from "vitest";

import { loginSchema } from "@/lib/schemas/auth";

// SCRUM-65 — the sign-in form and the Credentials provider share this schema,
// so these are the messages a user sees before any password is checked.
function firstError(input: unknown) {
  const result = loginSchema.safeParse(input);
  return result.success ? undefined : result.error.issues[0].message;
}

describe("sign-in input — SCRUM-65", () => {
  it("accepts an email and a password", () => {
    expect(
      loginSchema.safeParse({ email: "organiser@test.local", password: "x" }).success,
    ).toBe(true);
  });

  it("asks for a valid email address", () => {
    expect(firstError({ email: "organiser", password: "x" })).toBe(
      "Enter a valid email address.",
    );
  });

  it("asks for a password when it is left empty", () => {
    expect(firstError({ email: "organiser@test.local", password: "" })).toBe(
      "Enter your password.",
    );
  });
});
