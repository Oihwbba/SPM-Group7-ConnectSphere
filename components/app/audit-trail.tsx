import { Circle, User, type LucideIcon } from "lucide-react";

import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

export type TrailEntry = {
  id: string;
  at: Date | string;
  /** What happened, e.g. "Submitted as Pending Review". */
  title?: React.ReactNode;
  by?: string | null;
  note?: string | null;
  icon?: LucideIcon;
  tone?: "default" | "success" | "danger" | "info";
};

const TONE = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success/15 text-success",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-primary/10 text-primary",
};

/**
 * A history as a timeline (shared page conventions, changes 11 and 13): one
 * card per entry, oldest first, each saying what happened, who did it and
 * when. Entries are joined by a dotted line; a single entry has none.
 */
export function AuditTrail({
  entries,
  empty = "No updates yet.",
  entryTestId,
}: {
  entries: TrailEntry[];
  empty?: string;
  entryTestId?: string;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ol className="space-y-3">
      {entries.map((entry, i) => {
        const Icon = entry.icon ?? Circle;
        return (
          <li
            key={entry.id}
            data-testid={entryTestId}
            className={cn(
              "relative flex gap-3",
              i < entries.length - 1 &&
                "after:absolute after:-bottom-3 after:left-4 after:top-8 after:-translate-x-px after:border-l-2 after:border-dotted after:border-muted-foreground/40",
            )}
          >
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-background",
                TONE[entry.tone ?? "default"],
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-0.5 rounded-xl border bg-background px-3 py-2 text-sm">
              {entry.title && <p className="font-medium">{entry.title}</p>}
              {entry.note && (
                <p className="whitespace-pre-line text-foreground/90">
                  {entry.note}
                </p>
              )}
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 text-xs text-muted-foreground">
                <time dateTime={new Date(entry.at).toISOString()}>
                  {formatDateTime(entry.at)}
                </time>
                {entry.by && <PersonPill name={entry.by} prefix="by " />}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Who did something, as a pill with a person icon. */
export function PersonPill({
  name,
  prefix,
}: {
  name: string;
  /** Read out before the name, e.g. "by ". */
  prefix?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted/60 px-2 py-0.5 text-xs font-medium text-foreground">
      <User className="h-3 w-3 text-muted-foreground" aria-hidden />
      {prefix && <span className="sr-only">{prefix}</span>}
      {name}
    </span>
  );
}
