import { readFileSync } from "node:fs";

import { describe, it, expect, vi } from "vitest";

import {
  databaseEnv,
  parseEnvFile,
  run,
} from "../../.github/scripts/migrate-production.mjs";

// SCRUM-179 — the production deploy applies pending migrations first, with the
// database URLs from the environment `vercel pull` writes.
describe("migrate-production — SCRUM-179", () => {
  it("SCRUM-179 [AC1, AC3]: the deploy job applies migrations after vercel pull and before the build, and a failure stops it", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const stepAt = (command: string) => {
      const at = workflow.indexOf(command);
      expect(at, `deploy.yml runs ${command}`).toBeGreaterThan(-1);
      return at;
    };
    const pull = stepAt("pull --yes --environment=production");
    const migrate = stepAt("run: node .github/scripts/migrate-production.mjs");
    const build = stepAt("build --prod");

    expect(pull).toBeLessThan(migrate);
    expect(migrate).toBeLessThan(build);
    // A failed step must fail the job, so nothing after it runs.
    expect(workflow).not.toContain("continue-on-error");
  });

  it('SCRUM-179 [AC2]: reads KEY="value" lines with JSON escapes, and leaves a $ in a password as it is', () => {
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

  it("SCRUM-179 [AC3]: refuses a malformed value by its name, without printing the value", () => {
    expect(() =>
      parseEnvFile('DIRECT_URL="postgresql://app:secret@host"x"'),
    ).toThrow(
      new Error(
        ".vercel/.env.production.local has a malformed value for DIRECT_URL.",
      ),
    );
  });

  it("SCRUM-179 [AC2]: passes on only the two database URLs", () => {
    expect(
      databaseEnv({
        DATABASE_URL: "db",
        DIRECT_URL: "direct",
        AUTH_SECRET: "s",
      }),
    ).toEqual({ env: { DATABASE_URL: "db", DIRECT_URL: "direct" } });
  });

  it("SCRUM-179 [AC3]: names the database URL that's missing, so the deploy stops instead of building against an old schema", () => {
    expect(databaseEnv({ DATABASE_URL: "db" })).toEqual({
      missing: ["DIRECT_URL"],
    });
    expect(databaseEnv({ DATABASE_URL: "", DIRECT_URL: "" })).toEqual({
      missing: ["DATABASE_URL", "DIRECT_URL"],
    });
  });

  it("SCRUM-179 [AC1, AC2]: runs prisma migrate deploy with the production database URLs, read from the file vercel pull writes", () => {
    const readFile = vi
      .fn()
      .mockReturnValue(
        ['DATABASE_URL="db"', 'DIRECT_URL="direct"', 'AUTH_SECRET="s"'].join(
          "\n",
        ),
      );
    const exec = vi.fn();
    const log = vi.fn();

    expect(
      run({
        readFile,
        exec,
        log,
        baseEnv: { PATH: "/bin" },
      }),
    ).toBe(0);

    // Both URLs are masked in the job's log before Prisma can print either.
    expect(log.mock.calls).toEqual([
      ["::add-mask::db"],
      ["::add-mask::direct"],
    ]);
    expect(log.mock.invocationCallOrder[1]).toBeLessThan(
      exec.mock.invocationCallOrder[0],
    );
    expect(readFile).toHaveBeenCalledWith(".vercel/.env.production.local");
    expect(exec).toHaveBeenCalledWith(
      "npx",
      ["prisma", "migrate", "deploy"],
      expect.objectContaining({
        env: { PATH: "/bin", DATABASE_URL: "db", DIRECT_URL: "direct" },
      }),
    );
  });

  it("SCRUM-179 [AC3]: stops the deploy without running Prisma when a database URL is missing", () => {
    const exec = vi.fn();
    const log = vi.fn();

    expect(
      run({
        readFile: () => 'DATABASE_URL="db"',
        exec,
        log,
        baseEnv: {},
      }),
    ).toBe(1);

    expect(exec).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(
        /^::error::The production environment has no DIRECT_URL/,
      ),
    );
  });

  it("SCRUM-179 [AC3]: fails the step when a migration fails, so nothing is deployed", () => {
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
