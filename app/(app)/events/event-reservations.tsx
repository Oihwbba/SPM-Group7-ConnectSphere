import { listEventReservations } from "./queries";

/** SCRUM-33 — the equipment reserved for an event, on the coordinator's dashboard. */
export async function EventReservations({ eventId }: { eventId: string }) {
  const result = await listEventReservations(eventId);
  if (!result) return null;

  return (
    <section className="space-y-2">
      <h3 className="font-medium">{result.headline}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left">Equipment</th>
            <th className="text-right">Quantity</th>
          </tr>
        </thead>
        <tbody>
          {result.reservations.map((reservation) => (
            <tr key={reservation.id}>
              <td>{reservation.equipment.type}</td>
              <td className="text-right">{reservation.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
