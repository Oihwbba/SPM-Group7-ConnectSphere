/**
 * The event request's venue, layout, accessibility and equipment answers are
 * free text (SCRUM-13). The form offers them as choices plus "Other"
 * (shared page conventions, change 7), and these turn the text into choices
 * and back without changing what is stored: choices are listed comma-separated
 * after an optional prefix ("Preferred venue: ", "Requested equipment: "),
 * the way the catalogue buttons used to add them, and anything else is kept
 * as the "Other" text.
 */

/** Letters and digits only, so "U-Shape" and "u shape" are one choice. */
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export type Choices = { chosen: string[]; other: string };

/**
 * Split `text` into the options it names (in their own spelling) and the
 * rest. Text that names no option is returned untouched as `other`, so an
 * answer written before the choices existed is never rewritten.
 */
export function splitChoices(
  text: string,
  options: string[],
  prefix = "",
): Choices {
  const trimmed = text.trim();
  if (!trimmed) return { chosen: [], other: "" };
  const body =
    prefix && trimmed.toLowerCase().startsWith(prefix.trim().toLowerCase())
      ? trimmed.slice(prefix.trim().length).trim()
      : trimmed;
  const chosen: string[] = [];
  const rest: string[] = [];
  for (const part of body
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)) {
    const option = options.find((o) => key(o) === key(part));
    if (option && !chosen.includes(option)) chosen.push(option);
    else if (!option) rest.push(part);
  }
  if (chosen.length === 0) return { chosen: [], other: text };
  return { chosen, other: rest.join(", ") };
}

/** The text that `splitChoices` reads back as these choices. */
export function joinChoices({ chosen, other }: Choices, prefix = ""): string {
  const listed = chosen.length ? `${prefix}${chosen.join(", ")}` : "";
  const extra = other.trim();
  return [listed, extra].filter(Boolean).join(", ");
}

/** A single choice: the option the text names, or the text as "Other". */
export function splitChoice(text: string, options: string[]): Choices {
  const option = options.find((o) => key(o) === key(text));
  return option ? { chosen: [option], other: "" } : { chosen: [], other: text };
}
