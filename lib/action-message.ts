/**
 * SCRUM-207 AC4 — every error says what to do next. A message that already
 * does (it asks the user to choose, enter or fix something, or to refresh or
 * try again) is shown as it is; any other gets the next step added, the
 * caller's own or, by default, to look again and retry.
 */
export const DEFAULT_NEXT_STEP =
  "Refresh the page to see where it stands, then try again.";

const SAYS_WHAT_TO_DO =
  /^(choose|enter|pick|please|say|start|give|add|select|fill|check|ask)\b|\b(try again|refresh|instead|fix the|contact|ask )/i;

/** A refusal by role or relationship: trying again won't help. */
export const NOT_ALLOWED_NEXT_STEP =
  "If you think you should be able to, ask your coordinator.";

export function withNextStep(
  message: string,
  next: string = DEFAULT_NEXT_STEP,
): string {
  const text = message.trim();
  if (SAYS_WHAT_TO_DO.test(text)) return text;
  if (/^You do not have permission/.test(text)) {
    return `${text} ${NOT_ALLOWED_NEXT_STEP}`;
  }
  const ended = /[.!?]$/.test(text) ? text : `${text}.`;
  return `${ended} ${next}`;
}
