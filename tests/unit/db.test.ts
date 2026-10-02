import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// SCRUM-125 — lib/db.ts decides how the one shared Prisma client is built from
// NODE_ENV. The drivers are mocked: these check the options the client is given
// and whether it is cached across reloads, not that Postgres answers.
const PrismaClient = vi.fn(function (this: { options: unknown }, options: unknown) {
  this.options = options;
});

vi.mock("@prisma/client", () => ({ PrismaClient }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("pg", () => ({ Pool: vi.fn() }));

const globalForPrisma = globalThis as unknown as { prisma?: unknown };

async function loadDb(nodeEnv: string) {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.resetModules();
  return (await import("@/lib/db")).prisma as unknown as { options: { log: string[] } };
}

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
