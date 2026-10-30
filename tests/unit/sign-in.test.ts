import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";

// SCRUM-255 — the Credentials provider's `authorize`, as auth.ts builds it.
// `next-auth` and its provider are replaced by stand-ins that hand back the
// config, so the real `authorize` runs with the real bcrypt; only the
// database is mocked. Test cases: docs/testing/SCRUM-255.md.
const captured = vi.hoisted(() => ({
  config: undefined as
    | {
        providers: {
          authorize: (credentials: unknown) => Promise<unknown>;
        }[];
      }
    | undefined,
}));

vi.mock("next-auth", () => ({
  default: (config: typeof captured.config) => {
    captured.config = config;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  },
}));
vi.mock("next-auth/providers/credentials", () => ({
  default: (options: unknown) => options,
}));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

const PASSWORD = "Password123!";
// A cheap cost for the real account: what it hashes is what matters here.
const account = {
  id: "usr_organiser",
  name: "Olivia Organiser",
  email: "organiser@test.local",
  role: "ORGANISER",
  additionalRoles: [],
  passwordHash: bcrypt.hashSync(PASSWORD, 4),
};

const findUser = prisma.user.findUnique as unknown as Mock;
const compare = vi.spyOn(bcrypt, "compare");

async function authorize(email: string, password: string) {
  await import("@/auth");
  return captured.config!.providers[0].authorize({ email, password });
}

beforeEach(() => {
  findUser.mockReset();
  compare.mockClear();
});

describe("SCRUM-255 — sign-in takes as long for an unknown email", () => {
  it("SCRUM-255 [AC1, AC3] TC-255-01: an email with no account still has its password compared, against a bcrypt hash at the seed's cost", async () => {
    findUser.mockResolvedValue(null);

    expect(await authorize("nobody@test.local", PASSWORD)).toBeNull();

    expect(compare).toHaveBeenCalledTimes(1);
    const [password, hash] = compare.mock.calls[0];
    expect(password).toBe(PASSWORD);
    // The seed hashes at cost 10, so the dummy takes as long to compare.
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
    expect(hash).not.toBe(account.passwordHash);
  });

  it("SCRUM-255 [AC2] TC-255-02: an unknown email and a wrong password get the same answer, each after one comparison, and read nothing else", async () => {
    findUser.mockResolvedValueOnce(null);
    const unknown = await authorize("nobody@test.local", PASSWORD);
    findUser.mockResolvedValueOnce(account);
    const wrong = await authorize(account.email, "not-the-password");

    expect(unknown).toBeNull();
    expect(wrong).toBeNull();
    expect(compare).toHaveBeenCalledTimes(2);
    // Only the one lookup each: the mock has no other method to write with.
    expect(findUser).toHaveBeenCalledTimes(2);
  });

  it("SCRUM-255 [AC2] TC-255-03: the right password for a real account still signs in, with its role", async () => {
    findUser.mockResolvedValue(account);

    expect(await authorize(account.email, PASSWORD)).toEqual({
      id: "usr_organiser",
      name: "Olivia Organiser",
      email: "organiser@test.local",
      role: "ORGANISER",
      additionalRoles: [],
    });
    expect(compare).toHaveBeenCalledWith(PASSWORD, account.passwordHash);
  });

  it("SCRUM-255 [AC2] TC-255-03: a malformed sign-in is refused before the database, as before", async () => {
    expect(await authorize("not-an-email", "")).toBeNull();
    expect(findUser).not.toHaveBeenCalled();
    expect(compare).not.toHaveBeenCalled();
  });
});
