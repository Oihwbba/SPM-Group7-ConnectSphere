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
 * Run a Server Action from a client component, turning an unexpected throw into
 * the same `err(...)` shape an expected failure returns.
 *
 * Actions already return `ActionResult` for expected failures, so a client
 * normally only branches on `result.ok`. But an *unexpected* error — a bug, a
 * dropped connection, an unhandled rejection in the action — rejects the
 * promise instead of returning. Inside `startTransition(async () => …)` that
 * rejection escapes the transition: the pending flag never clears, so the
 * button stays disabled forever and the user is told nothing.
 *
 * Wrapping the call turns that into a normal `err(...)`, which every call site
 * already renders. Expected failures are unaffected — they never threw.
 *
 * The message is deliberately generic: the underlying error is a bug, and its
 * text is for the console, not the user.
 */
export async function runAction<T>(
  action: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await action();
  } catch (error) {
    console.error("Server action failed unexpectedly:", error);
    return err("Something went wrong. Please try again.");
  }
}
