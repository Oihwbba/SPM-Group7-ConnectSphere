import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
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
 * Supabase's session pooler accepts 43 connections (its Pool Size setting),
 * shared by every copy of the app: each Vercel instance, including ones left
 * from an earlier deploy, and each teammate's dev server. So each copy opens at
 * most 3, and gives an idle one back after 5 seconds. A local database has no
 * such limit, so it keeps pg's defaults. SCRUM-240, ADR 0022.
 */
const SUPABASE_POOL = { max: 3, idleTimeoutMillis: 5_000 };
const LOCAL_DATABASE = /@(localhost|127\.0\.0\.1)[:/]/;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool(
    LOCAL_DATABASE.test(connectionString ?? "")
      ? { connectionString }
      : { connectionString, ...SUPABASE_POOL },
  );
  // Vercel pauses an instance between requests, which also pauses pg's idle
  // timer, so a paused instance would keep its connections open. This keeps
  // the instance awake until they close. Off Vercel it does nothing.
  attachDatabasePool(pool);
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
