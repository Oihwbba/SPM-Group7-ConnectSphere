/**
 * SCRUM-34 AC10, AC11 — the future bookings that stopped an edit or a
 * retirement, each with why, as the action returned them.
 */
export function AffectedBookings({ bookings }: { bookings: string[] }) {
  if (bookings.length === 0) return null;
  return (
    <div
      role="alert"
      data-testid="affected-bookings"
      className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
    >
      <p className="font-medium text-destructive">Affected bookings</p>
      <ul className="list-disc space-y-1 pl-5">
        {bookings.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
