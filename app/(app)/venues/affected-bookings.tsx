/** SCRUM-34 AC10, AC11 — the future bookings a change affects, as the action returned them. */
export type Affected = { lines: string[]; ids: string[] };

export const NONE_AFFECTED: Affected = { lines: [], ids: [] };

/** 1 -> "1 booking", 2 -> "2 bookings" */
export function bookingsCount(n: number): string {
  return `${n} booking${n === 1 ? "" : "s"}`;
}

/** What a confirmed change flagged, for the success message. */
export function flaggedNote(flagged: number): string {
  return flagged > 0 ? ` ${bookingsCount(flagged)} flagged Needs Reconsideration.` : "";
}

/**
 * SCRUM-34 AC10, AC11 — the future bookings a change or a retirement would
 * affect, each with why. Confirming flags them Needs Reconsideration.
 */
export function AffectedBookings({ bookings }: { bookings: string[] }) {
  if (bookings.length === 0) return null;
  return (
    <div
      role="alert"
      data-testid="affected-bookings"
      className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
    >
      <p className="font-medium text-destructive">
        Affected bookings — confirming flags them Needs Reconsideration
      </p>
      <ul className="list-disc space-y-1 pl-5">
        {bookings.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
