/**
 * An event field as an audit row or a change request records it in its
 * text `oldValue`/`newValue` columns. An empty optional field is the same as
 * a missing one, so clearing it and leaving it blank compare equal.
 */
export function auditValue(
  value: string | number | boolean | Date | string[] | null | undefined,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  return Array.isArray(value) ? value.join(", ") : String(value);
}
