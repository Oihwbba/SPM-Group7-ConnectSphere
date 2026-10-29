import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// SCRUM-125 — lib/db.ts decides how the one shared Prisma client is built from
// NODE_ENV. The drivers are mocked: these check the options the client is given
// and whether it is cached across reloads, not that Postgres answers.
const PrismaClient = vi.fn(function (this: { options: unknown }, options: unknown) {
  this.options = options;
});

const Pool = vi.fn();

vi.mock("@prisma/client", () => ({ PrismaClient }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("pg", () => ({ Pool }));

const globalForPrisma = globalThis as unknown as { prisma?: unknown };

async function loadDb(nodeEnv: string) {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.resetModules();
  return (await import("@/lib/db")).prisma as unknown as { options: { log: string[] } };
}

const SUPABASE_URL =
  "postgresql://postgres.ref:secret@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";

async function poolOptionsFor(databaseUrl: string) {
  vi.stubEnv("DATABASE_URL", databaseUrl);
  await loadDb("production");
  return Pool.mock.calls[0][0];
}

describe("database pool size — SCRUM-240", () => {
  beforeEach(() => {
    delete globalForPrisma.prisma;
    Pool.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete globalForPrisma.prisma;
  });

  it("SCRUM-240 [AC1, AC2] TC-240-01: a pool on Supabase opens at most 3 connections", async () => {
    expect(await poolOptionsFor(SUPABASE_URL)).toEqual({
      connectionString: SUPABASE_URL,
      max: 3,
    });
  });

  it.each([
    "postgresql://connectsphere:connectsphere@127.0.0.1:5432/connectsphere?schema=public",
    "postgresql://connectsphere:connectsphere@localhost:5432/connectsphere",
    "postgresql://connectsphere:connectsphere@localhost/connectsphere",
  ])("SCRUM-240 [AC1] TC-240-02: a pool on a local database keeps pg's default size (%s)", async (url) => {
    expect(await poolOptionsFor(url)).toEqual({ connectionString: url });
  });

  it("SCRUM-240 [AC1] TC-240-03: a host that only starts with localhost is not local", async () => {
    const url = "postgresql://user:secret@localhost.example.com:5432/postgres";

    expect(await poolOptionsFor(url)).toEqual({ connectionString: url, max: 3 });
  });
});

describe("shared Prisma client — SCRUM-125", () => {
  beforeEach(() => {
    delete globalForPrisma.prisma;
    PrismaClient.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete globalForPrisma.prisma;
  });

  it("logs warnings as well as errors in development", async () => {
    const prisma = await loadDb("development");

    expect(prisma.options.log).toEqual(["error", "warn"]);
  });

  it("logs only errors in production", async () => {
    const prisma = await loadDb("production");

    expect(prisma.options.log).toEqual(["error"]);
  });

  it("keeps the client across hot reloads outside production", async () => {
    const first = await loadDb("development");
    const second = await loadDb("development");

    expect(second).toBe(first);
    expect(PrismaClient).toHaveBeenCalledTimes(1);
  });

  it("does not cache the client globally in production", async () => {
    const prisma = await loadDb("production");

    expect(prisma).toBeDefined();
    expect(globalForPrisma.prisma).toBeUndefined();
  });
});
