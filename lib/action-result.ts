import type { ZodError } from "zod";

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

/**
 * Validation errors keyed by the field they belong to, so a form can show
 * each next to its input: a value nested under `changes` (a clarification
 * answer's, a change request's) under its own name, e.g. "endAt", and
 * anything else under its top-level name.
 */
export function errorsByField(error: ZodError): Record<string, string[]> {
  const byField: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const [top, nested] = issue.path;
    const key = String(top === "changes" && nested !== undefined ? nested : top);
    (byField[key] ??= []).push(issue.message);
  }
  return byField;
}
