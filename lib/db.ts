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

/**
 * Supabase's session pooler accepts 15 connections shared by every copy of the
 * app: each Vercel instance and each teammate's dev server. pg's default of 10
 * per pool let two copies exhaust it (SCRUM-240, ADR 0022). A local database
 * has no such limit, so it keeps the default.
 */
const SUPABASE_POOL_MAX = 3;
const LOCAL_DATABASE = /@(localhost|127\.0\.0\.1)[:/]/;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool(
    LOCAL_DATABASE.test(connectionString ?? "")
      ? { connectionString }
      : { connectionString, max: SUPABASE_POOL_MAX },
  );
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
