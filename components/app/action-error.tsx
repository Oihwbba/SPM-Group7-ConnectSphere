import { withNextStep } from "@/lib/action-message";

/**
 * SCRUM-207 AC4 — the one place an action's error appears: inline, beside
 * the form or button that failed, saying what to do next. Successes are a
 * toast; errors are never only a toast.
 */
export function ActionError({
  message,
  next,
  testId = "action-error",
}: {
  message: string | null | undefined;
  /** What to do next, where this action knows better than the default. */
  next?: string;
  testId?: string;
}) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive" data-testid={testId}>
      {withNextStep(message, next)}
    </p>
  );
}
