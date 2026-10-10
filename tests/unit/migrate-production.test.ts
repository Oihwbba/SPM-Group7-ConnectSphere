import { describe, it, expect } from "vitest";

import {
  databaseEnv,
  parseEnvFile,
} from "../../.github/scripts/migrate-production.mjs";

// SCRUM-89 — the production deploy applies pending migrations first, with the
// database URLs from the environment `vercel pull` writes.
describe("migrate-production — SCRUM-89", () => {
  it("reads KEY=\"value\" lines with JSON escapes, and leaves a $ in a password as it is", () => {
    const text = [
      "# Created by Vercel CLI",
      'DATABASE_URL="postgresql://app:pa$$w0rd@pooler:5432/postgres?pgbouncer=true"',
      'DIRECT_URL="postgresql://app:pa$$w0rd@pooler:5432/postgres"',
      'AUTH_SECRET="a\\"quoted\\"secret"',
      "VERCEL=1",
      "",
    ].join("\r\n");

    expect(parseEnvFile(text)).toEqual({
      DATABASE_URL: "postgresql://app:pa$$w0rd@pooler:5432/postgres?pgbouncer=true",
      DIRECT_URL: "postgresql://app:pa$$w0rd@pooler:5432/postgres",
      AUTH_SECRET: 'a"quoted"secret',
      VERCEL: "1",
    });
  });

  it("passes on only the two database URLs", () => {
    expect(
      databaseEnv({ DATABASE_URL: "db", DIRECT_URL: "direct", AUTH_SECRET: "s" }),
    ).toEqual({ env: { DATABASE_URL: "db", DIRECT_URL: "direct" } });
  });

  it("names the database URL that's missing, so the deploy stops instead of building against an old schema", () => {
    expect(databaseEnv({ DATABASE_URL: "db" })).toEqual({ missing: ["DIRECT_URL"] });
    expect(databaseEnv({ DATABASE_URL: "", DIRECT_URL: "" })).toEqual({
      missing: ["DATABASE_URL", "DIRECT_URL"],
    });
  });
});
