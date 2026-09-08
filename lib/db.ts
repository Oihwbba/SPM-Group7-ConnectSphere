import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/**
 * A single shared Prisma client. In development Next.js hot-reloads modules,
 * which would otherwise open a new database connection on every reload and
 * exhaust the pool, so we cache the client on `globalThis`.
 *
 * We talk to Postgres through the pure-JS `pg` driver adapter rather than the
 * native query engine (see the generator note in prisma/schema.prisma). This
 * is what lets the app run on any architecture — including Windows-on-ARM,
 * which has no native Prisma engine.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
