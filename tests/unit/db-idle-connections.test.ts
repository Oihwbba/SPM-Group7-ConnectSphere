import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Pool } from "pg";

// SCRUM-240 — with the real pg Pool and the real @vercel/functions helper, a
// released connection keeps a Vercel instance awake until pg has closed it.
// Nothing connects: the release is emitted by hand.
const { attachDatabasePool } = vi.hoisted(() => ({ attachDatabasePool: vi.fn() }));

vi.mock("@vercel/functions", async (importOriginal) => {
  const real = await importOriginal<typeof import("@vercel/functions")>();
  attachDatabasePool.mockImplementation(real.attachDatabasePool);
  return { ...real, attachDatabasePool };
});

const REQUEST_CONTEXT = Symbol.for("@vercel/request-context");
const globals = globalThis as unknown as Record<symbol | string, unknown>;

const SUPABASE_URL =
  "postgresql://postgres.ref:secret@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";

async function loadPool(): Promise<Pool> {
  vi.stubEnv("DATABASE_URL", SUPABASE_URL);
  vi.stubEnv("NODE_ENV", "production");
  vi.resetModules();
  attachDatabasePool.mockClear();
  await import("@/lib/db");
  return attachDatabasePool.mock.calls[0][0] as Pool;
}

function settled(promise: Promise<unknown>) {
  const state = { done: false };
  void promise.then(() => (state.done = true));
  return state;
}

describe("idle connections on Vercel — SCRUM-240", () => {
  const waitUntil = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    waitUntil.mockClear();
    globals[REQUEST_CONTEXT] = { get: () => ({ waitUntil }) };
    delete globals.prisma;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    delete globals[REQUEST_CONTEXT];
    delete globals.prisma;
  });

  it("SCRUM-240 [AC4] TC-240-06: on Vercel, a released connection keeps the instance awake until the 5-second idle timeout has passed", async () => {
    vi.stubEnv("VERCEL_URL", "spm-group7-connect-sphere.vercel.app");
    vi.stubEnv("VERCEL_REGION", "sin1");
    const pool = await loadPool();

    pool.emit("release", undefined, {});

    expect(waitUntil).toHaveBeenCalledTimes(1);
    const awake = settled(waitUntil.mock.calls[0][0]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(awake.done).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    expect(awake.done).toBe(true);
  });

  it("SCRUM-240 [AC4] TC-240-07: off Vercel, a released connection keeps nothing awake", async () => {
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("VERCEL_REGION", "");
    const pool = await loadPool();

    pool.emit("release", undefined, {});

    expect(waitUntil).not.toHaveBeenCalled();
  });
});
