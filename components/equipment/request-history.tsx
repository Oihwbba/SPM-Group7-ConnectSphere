import type { EquipmentRequestStatus } from "@prisma/client";

import { formatDateTime } from "@/lib/datetime";
import { EQUIPMENT_REQUEST_STATUS_LABEL } from "@/lib/equipment/requests";

type Entry = {
  id: string;
  createdAt: Date;
  fromStatus: EquipmentRequestStatus | null;
  toStatus: EquipmentRequestStatus | null;
  note: string | null;
  actor: { name: string | null };
};

/** What an entry changed, in words: a status move, or a note on its own. */
function describe(entry: Entry): string | null {
  const to = entry.toStatus && EQUIPMENT_REQUEST_STATUS_LABEL[entry.toStatus];
  if (!to) return null;
  if (!entry.fromStatus) return `Submitted as ${to}`;
  return `${EQUIPMENT_REQUEST_STATUS_LABEL[entry.fromStatus]} → ${to}`;
}

/**
 * SCRUM-28 AC 5 — "a chronological history log of all updates made", oldest
 * first. Collapsed by default so a long log doesn't push the next request
 * off-screen; the summary says how many entries it holds.
 */
export function RequestHistory({ entries }: { entries: Entry[] }) {
  return (
    <details
      className="group rounded-md border bg-muted/20 text-sm"
      data-testid="request-history"
    >
      <summary className="cursor-pointer select-none px-3 py-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        History ({entries.length})
      </summary>
      {entries.length === 0 && (
        <p className="border-t px-3 py-3 text-muted-foreground">
          No updates yet.
        </p>
      )}
      <ol className="space-y-3 border-t px-3 py-3 empty:hidden">
        {entries.map((entry) => {
          const change = describe(entry);
          return (
            <li
              key={entry.id}
              className="space-y-0.5"
              data-testid="history-entry"
            >
              <p className="text-xs text-muted-foreground">
                <time dateTime={entry.createdAt.toISOString()}>
                  {formatDateTime(entry.createdAt)}
                </time>
                {entry.actor.name ? `, by ${entry.actor.name}` : ""}
              </p>
              {change && <p className="font-medium">{change}</p>}
              {entry.note && (
                <p className="whitespace-pre-line">{entry.note}</p>
              )}
            </li>
          );
        })}
      </ol>
    </details>
  );
}
