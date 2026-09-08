/**
 * The single shape every Server Action returns. Feature developers: your
 * actions return this — never throw across the action boundary for expected
 * failures (validation, permission), because the client cannot catch a thrown
 * error from a server action cleanly. Return `err(...)` instead.
 *
 * `fieldErrors` mirrors the shape of Zod's `flatten().fieldErrors`, so a form
 * can map each message back to its input.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function err<T = never>(
  error: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<T> {
  return { ok: false, error, fieldErrors };
}
