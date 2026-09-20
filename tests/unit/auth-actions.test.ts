import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";
import { authenticate, signOutAction } from "@/lib/auth/actions";

// SCRUM-65 — sign-in / sign-out server actions. `@/auth` is mocked so this is a
// fast unit test with no database or network; we drive every branch of the
// actions and assert on both the returned message and the delegated call.
vi.mock("@/auth", () => ({ signIn: vi.fn(), signOut: vi.fn() }));

// `next-auth`'s real entry pulls in `next/server`, which isn't resolvable under
// Vitest. actions.ts only needs the `AuthError` class for its `instanceof`
// check, so we mock the package with a minimal stand-in. Because both this test
// and actions.ts import the same (mocked) class, `instanceof` still holds.
vi.mock("next-auth", () => {
  class AuthError extends Error {}
  return { AuthError };
});

const mockSignIn = signIn as unknown as Mock;
const mockSignOut = signOut as unknown as Mock;

function loginForm(email = "user@test.local", password = "secret"): FormData {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  return data;
}

// authenticate() checks `error instanceof AuthError` and `error.type`, so we
// throw a real AuthError with the type set to the case under test.
function authErrorOfType(type: string): AuthError {
  const error = new AuthError("test");
  (error as unknown as { type: string }).type = type;
  return error;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("authenticate — SCRUM-65", () => {
  it("returns a generic message when credentials are rejected (no account enumeration)", async () => {
    mockSignIn.mockRejectedValue(authErrorOfType("CredentialsSignin"));

    const result = await authenticate(undefined, loginForm());

    expect(result).toBe("Invalid email or password.");
    expect(mockSignIn).toHaveBeenCalledWith(
      "credentials",
      expect.objectContaining({ redirectTo: "/" }),
    );
  });

  it("returns a fallback message for any other auth error", async () => {
    mockSignIn.mockRejectedValue(authErrorOfType("Configuration"));

    const result = await authenticate(undefined, loginForm());

    expect(result).toBe("Something went wrong signing in. Please try again.");
  });

  it("re-throws a non-auth error (the NEXT_REDIRECT thrown on a successful sign-in)", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    mockSignIn.mockRejectedValue(redirect);

    await expect(authenticate(undefined, loginForm())).rejects.toBe(redirect);
  });

  it("returns undefined when signIn resolves without throwing", async () => {
    mockSignIn.mockResolvedValue(undefined);

    const result = await authenticate(undefined, loginForm());

    expect(result).toBeUndefined();
  });
});

describe("signOutAction — SCRUM-65", () => {
  it("signs the user out and sends them back to /login", async () => {
    mockSignOut.mockResolvedValue(undefined);

    await signOutAction();

    expect(mockSignOut).toHaveBeenCalledWith({ redirectTo: "/login" });
  });
});
