import { describe, expect, it } from "vitest";

import { loginSchema } from "@/lib/schemas/auth";

describe("login schema", () => {
  it("accepts valid credentials and reports invalid email/password fields", () => {
    expect(
      loginSchema.parse({
        email: "organiser@test.local",
        password: "Password123!",
      }),
    ).toEqual({
      email: "organiser@test.local",
      password: "Password123!",
    });

    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toContain(
        "Enter a valid email address.",
      );
      expect(result.error.flatten().fieldErrors.password).toContain(
        "Enter your password.",
      );
    }
  });
});
