/**
 * Recognising PostgreSQL's refusals, shared by every action that relies on
 * the database to enforce a rule (booking_no_double_booking, the occupancy
 * triggers — see docs/adr/0010).
 */

/**
 * The PostgreSQL error code and message behind a failed query. Through the
 * `pg` driver adapter, Prisma surfaces a database refusal as a
 * DriverAdapterError whose `cause` carries the original code and message. A
 * raw query (`$queryRaw`) wraps that DriverAdapterError in a P2010 error's
 * `meta.driverAdapterError` instead (SCRUM-202: an approval aborted as a
 * deadlock while locking the venue).
 */
export function postgresError(error: unknown) {
  type Cause = { originalCode?: string; originalMessage?: string };
  const wrapped = error as {
    cause?: Cause;
    meta?: { driverAdapterError?: { cause?: Cause } };
  } | null;
  const cause = wrapped?.cause ?? wrapped?.meta?.driverAdapterError?.cause;
  return { code: cause?.originalCode, message: cause?.originalMessage ?? "" };
}

/** The write was refused by the exclusion constraint named `constraint`. */
export function violatesExclusion(error: unknown, constraint: string): boolean {
  const pg = postgresError(error);
  return pg.code === "23P01" && pg.message.includes(`"${constraint}"`);
}

/**
 * The write was refused by the check constraint, or the trigger raising as
 * one, named `constraint` (e.g. booking_hold_expired, SCRUM-163).
 */
export function violatesCheck(error: unknown, constraint: string): boolean {
  const pg = postgresError(error);
  return pg.code === "23514" && pg.message.includes(`"${constraint}"`);
}

/**
 * Runs `attempt`, and runs it once more if PostgreSQL aborted it as a
 * deadlock (SQLSTATE 40P01).
 *
 * Why this exists: when two overlapping rows are written at the same instant,
 * each can be left waiting for the other's uncommitted row in the exclusion
 * constraint. Postgres breaks that cycle by aborting one of them as a deadlock
 * rather than reporting a constraint violation. The survivor carries on. On
 * the retry the survivor's row is (or is about to be) committed, so the retry
 * gets the ordinary answer — the existing request, or a conflict.
 */
export async function onceMoreOnDeadlock<T>(
  attempt: () => Promise<T>,
): Promise<T> {
  try {
    return await attempt();
  } catch (error) {
    if (postgresError(error).code !== "40P01") throw error;
    return attempt();
  }
}
