type Line = {
  id: string;
  quantity: number;
  technicalRequirements: string | null;
  equipment: { type: string };
};

// Equipment, quantity and requirements as columns from `sm` up; on a phone
// each line stacks, with the quantity labelled by CSS so the text stays clean.
const COLUMNS = "sm:grid-cols-[minmax(0,2fr)_5rem_minmax(0,3fr)]";

/** SCRUM-27 — the equipment lines of one request. */
export function RequestLines({ lines }: { lines: Line[] }) {
  return (
    <div className="text-sm">
      <div
        aria-hidden="true"
        className={`hidden gap-4 border-b pb-2 text-xs font-medium text-muted-foreground sm:grid ${COLUMNS}`}
      >
        <span>Equipment</span>
        <span className="text-right">Quantity</span>
        <span>Technical requirements</span>
      </div>
      <ul className="divide-y">
        {lines.map((line) => (
          <li
            key={line.id}
            data-testid="request-line"
            className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 py-3 sm:items-baseline ${COLUMNS}`}
          >
            <span className="font-medium">{line.equipment.type}</span>
            <span className="text-right tabular-nums before:text-muted-foreground before:content-['Qty_'] sm:before:content-none">
              {line.quantity}
            </span>
            <span className="col-span-2 whitespace-pre-line text-muted-foreground sm:col-span-1">
              {line.technicalRequirements ?? "None given"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
