import { describe, it, expect, vi } from "vitest";

import {
  databaseEnv,
  parseEnvFile,
  run,
} from "../../.github/scripts/migrate-production.mjs";

// SCRUM-89 — the production deploy applies pending migrations first, with the
// database URLs from the environment `vercel pull` writes.
describe("migrate-production — SCRUM-89", () => {
  it('reads KEY="value" lines with JSON escapes, and leaves a $ in a password as it is', () => {
    const text = [
      "# Created by Vercel CLI",
      'DATABASE_URL="postgresql://app:pa$$w0rd@pooler:5432/postgres?pgbouncer=true"',
      'DIRECT_URL="postgresql://app:pa$$w0rd@pooler:5432/postgres"',
      'AUTH_SECRET="a\\"quoted\\"secret"',
      "VERCEL=1",
      "",
    ].join("\r\n");

    expect(parseEnvFile(text)).toEqual({
      DATABASE_URL:
        "postgresql://app:pa$$w0rd@pooler:5432/postgres?pgbouncer=true",
      DIRECT_URL: "postgresql://app:pa$$w0rd@pooler:5432/postgres",
      AUTH_SECRET: 'a"quoted"secret',
      VERCEL: "1",
    });
  });

  it("passes on only the two database URLs", () => {
    expect(
      databaseEnv({
        DATABASE_URL: "db",
        DIRECT_URL: "direct",
        AUTH_SECRET: "s",
      }),
    ).toEqual({ env: { DATABASE_URL: "db", DIRECT_URL: "direct" } });
  });

  it("names the database URL that's missing, so the deploy stops instead of building against an old schema", () => {
    expect(databaseEnv({ DATABASE_URL: "db" })).toEqual({
      missing: ["DIRECT_URL"],
    });
    expect(databaseEnv({ DATABASE_URL: "", DIRECT_URL: "" })).toEqual({
      missing: ["DATABASE_URL", "DIRECT_URL"],
    });
  });

  it("runs prisma migrate deploy with the production database URLs, read from the file vercel pull writes", () => {
    const readFile = vi
      .fn()
      .mockReturnValue(
        ['DATABASE_URL="db"', 'DIRECT_URL="direct"', 'AUTH_SECRET="s"'].join(
          "\n",
        ),
      );
    const exec = vi.fn();

    expect(
      run({ readFile, exec, log: vi.fn(), baseEnv: { PATH: "/bin" } }),
    ).toBe(0);

    expect(readFile).toHaveBeenCalledWith(".vercel/.env.production.local");
    expect(exec).toHaveBeenCalledWith(
      "npx",
      ["prisma", "migrate", "deploy"],
      expect.objectContaining({
        env: { PATH: "/bin", DATABASE_URL: "db", DIRECT_URL: "direct" },
      }),
    );
  });

  it("stops the deploy without running Prisma when a database URL is missing", () => {
    const exec = vi.fn();
    const log = vi.fn();

    expect(
      run({ readFile: () => 'DATABASE_URL="db"', exec, log, baseEnv: {} }),
    ).toBe(1);

    expect(exec).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(
        /^::error::The production environment has no DIRECT_URL/,
      ),
    );
  });

  it("fails the step when a migration fails, so nothing is deployed", () => {
    const exec = vi.fn(() => {
      throw new Error("P3009: migrate found failed migrations");
    });

    expect(() =>
      run({
        readFile: () => 'DATABASE_URL="db"\nDIRECT_URL="direct"',
        exec,
        log: vi.fn(),
        baseEnv: {},
      }),
    ).toThrow("P3009");
  });
});
