import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";

// SCRUM-67 — the page-level session guard. `@/auth` and next/navigation's
// redirect are mocked. The real redirect() throws to halt rendering, so our
// mock throws too — that lets us assert the deny path never falls through to
// returning a session.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

const mockAuth = auth as unknown as Mock;
const mockRedirect = redirect as unknown as Mock;

const signedIn: Session = {
  user: { id: "u1", role: "ORGANISER", name: "Olivia", email: "o@test.local" },
  expires: "2999-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireSession — SCRUM-67", () => {
  it("SCRUM-67 [AC3] TC-67-04: returns the session and does not redirect when signed in (allow path)", async () => {
    mockAuth.mockResolvedValue(signedIn);

    const result = await requireSession();

    expect(result).toBe(signedIn);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("SCRUM-65 [AC4, AC5] TC-65-04, SCRUM-67 [AC3] TC-67-04: redirects to /login when there is no session (deny path)", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(requireSession()).rejects.toThrow("REDIRECT:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("SCRUM-67 [AC3] TC-67-04: redirects to /login when the session has no user (deny path)", async () => {
    mockAuth.mockResolvedValue({
      expires: "2999-01-01T00:00:00.000Z",
    } as unknown as Session);

    await expect(requireSession()).rejects.toThrow("REDIRECT:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});
