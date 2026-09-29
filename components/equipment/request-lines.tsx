import type { ReactNode } from "react";

type Line = {
  id: string;
  quantity: number;
  technicalRequirements: string | null;
  equipment: { type: string; technicalSpecs?: string | null };
  suggestedAlternative?: { type: string } | null;
};

// Equipment, quantity and requirements as columns from `sm` up; on a phone
// each line stacks, with the quantity labelled by CSS so the text stays clean.
const COLUMNS = "sm:grid-cols-[minmax(0,2fr)_5rem_minmax(0,3fr)]";

/**
 * SCRUM-27/28 — the equipment lines of one request, with any alternative
 * Technical Support suggested. `detail` adds a row under a line: the review
 * queue uses it for availability and the suggestion form.
 */
export function RequestLines<T extends Line>({
  lines,
  detail,
}: {
  lines: T[];
  detail?: (line: T) => ReactNode;
}) {
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
            <span className="min-w-0">
              <span className="font-medium">{line.equipment.type}</span>
              {line.equipment.technicalSpecs && (
                <span className="block text-xs text-muted-foreground">
                  Specs: {line.equipment.technicalSpecs}
                </span>
              )}
            </span>
            <span className="text-right tabular-nums before:text-muted-foreground before:content-['Qty_'] sm:before:content-none">
              {line.quantity}
            </span>
            <span className="col-span-2 whitespace-pre-line text-muted-foreground sm:col-span-1">
              {line.technicalRequirements ?? "None given"}
            </span>
            {line.suggestedAlternative && (
              <p
                className="col-span-full text-sm font-medium text-info"
                data-testid="suggested-alternative"
              >
                Suggested instead: {line.suggestedAlternative.type}
              </p>
            )}
            {detail && <div className="col-span-full">{detail(line)}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
