import { afterEach, describe, expect, it, vi } from "vitest";

const prismaClientMock = vi.hoisted(() => vi.fn());
const prismaPgMock = vi.hoisted(() => vi.fn());
const poolMock = vi.hoisted(() => vi.fn());

vi.mock("@prisma/client", () => ({
  PrismaClient: prismaClientMock,
}));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: prismaPgMock,
}));

vi.mock("pg", () => ({
  Pool: poolMock,
}));

function clearCachedPrisma() {
  delete (globalThis as { prisma?: unknown }).prisma;
}

async function importDbWithEnv(nodeEnv: string) {
  vi.resetModules();
  clearCachedPrisma();
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("DATABASE_URL", "postgres://unit-test");
  prismaClientMock.mockReturnValue({ client: nodeEnv });
  prismaPgMock.mockReturnValue({ adapter: nodeEnv });
  poolMock.mockReturnValue({ pool: nodeEnv });

  return import("@/lib/db");
}

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  clearCachedPrisma();
  vi.unstubAllEnvs();
});

describe("database client — SCRUM-67", () => {
  it("SCRUM-67 [AC1]: creates and caches a development Prisma client with verbose logs", async () => {
    const { prisma } = await importDbWithEnv("development");

    expect(poolMock).toHaveBeenCalledWith({
      connectionString: "postgres://unit-test",
    });
    expect(prismaPgMock).toHaveBeenCalledWith({ pool: "development" });
    expect(prismaClientMock).toHaveBeenCalledWith({
      adapter: { adapter: "development" },
      log: ["error", "warn"],
    });
    expect((globalThis as { prisma?: unknown }).prisma).toBe(prisma);
  });

  it("SCRUM-67 [AC1]: reuses an existing cached Prisma client", async () => {
    vi.resetModules();
    const cachedClient = { client: "cached" };
    (globalThis as { prisma?: unknown }).prisma = cachedClient;
    vi.stubEnv("NODE_ENV", "development");

    const { prisma } = await import("@/lib/db");

    expect(prisma).toBe(cachedClient);
    expect(poolMock).not.toHaveBeenCalled();
    expect(prismaClientMock).not.toHaveBeenCalled();
  });

  it("SCRUM-67 [AC1]: creates a production Prisma client without caching it globally", async () => {
    const { prisma } = await importDbWithEnv("production");

    expect(prisma).toEqual({ client: "production" });
    expect(prismaClientMock).toHaveBeenCalledWith({
      adapter: { adapter: "production" },
      log: ["error"],
    });
    expect((globalThis as { prisma?: unknown }).prisma).toBeUndefined();
  });
});
