import { Check, X } from "lucide-react";
import type { EventStatus } from "@prisma/client";

import { EVENT_STATUS_LABEL } from "@/lib/status-labels";
import { cn } from "@/lib/utils";

const STEPS = ["Request", "Review", "Planning", "Confirmed", "Completed"] as const;

/** Where each status sits on the way from request to completed event. */
const STEP_OF: Record<EventStatus, number> = {
  DRAFT: 0,
  SUBMITTED: 1,
  UNDER_REVIEW: 1,
  REJECTED: 1,
  APPROVED: 2,
  PLANNING: 2,
  CONFIRMED: 3,
  COMPLETED: 4,
  CANCELLED: -1,
};

/**
 * SCRUM-208 AC2 — the event's status as its place on the way: the steps done
 * are ticked, the current one glows in the site's primary colour, and a Rejected request is marked
 * where it stopped. A Cancelled event shows how far it got, then Cancelled.
 * Carries the status for tests and screen readers as the badge did.
 *
 * SCRUM-248 AC2: one row of labelled steps doesn't fit a phone, so below
 * `md` each label sits under its dot and the line runs between the dots,
 * above the labels; from `md` up, label and line follow the dot on one row.
 */
export function EventProgress({
  status,
  cancelledFrom = null,
}: {
  status: EventStatus;
  /** For a Cancelled event, the status it was cancelled from, when known. */
  cancelledFrom?: EventStatus | null;
}) {
  const cancelled = status === "CANCELLED";
  const rejected = status === "REJECTED";
  const current = cancelled ? STEP_OF[cancelledFrom ?? "PLANNING"] : STEP_OF[status];
  const finished = status === "COMPLETED";

  return (
    <div
      data-testid="status-badge"
      data-status={status}
      className="py-1"
    >
      <p className="sr-only">Status: {EVENT_STATUS_LABEL[status]}</p>
      <ol
        className="flex items-start overflow-x-auto [scrollbar-width:none] md:items-center md:gap-1 [&::-webkit-scrollbar]:hidden"
        aria-label="Progress"
      >
        {STEPS.map((step, i) => {
          const done = i < current || (finished && i === current);
          const here = i === current && !finished;
          const stopped = here && (rejected || cancelled);
          return (
            <li
              key={step}
              className="relative flex min-w-0 flex-1 flex-col items-center md:flex-row md:gap-1 md:last:flex-none"
              aria-current={here ? "step" : undefined}
            >
              <span className="flex shrink-0 flex-col items-center gap-1 md:flex-row md:gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border-2",
                    done && "border-primary bg-primary text-primary-foreground",
                    here && !stopped && "border-primary bg-primary/15",
                    stopped && "border-destructive bg-destructive text-destructive-foreground",
                    !done && !here && "border-muted-foreground/30 bg-background",
                  )}
                >
                  {done && <Check className="h-3 w-3" strokeWidth={3} />}
                  {stopped && <X className="h-3 w-3" strokeWidth={3} />}
                  {here && !stopped && (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_8px_2px_hsl(var(--primary)/0.6)]" />
                    </span>
                  )}
                </span>
                <span
                  data-testid="progress-label"
                  className={cn(
                    "whitespace-nowrap text-[11px] md:text-sm",
                    here ? "font-semibold text-primary" : "text-muted-foreground",
                    stopped && "text-destructive",
                  )}
                >
                  {stopped ? (rejected ? "Rejected" : "Cancelled") : step}
                </span>
              </span>
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  data-testid="progress-line"
                  className={cn(
                    // Phone: from beside this dot to beside the next one.
                    "absolute left-[calc(50%+0.875rem)] right-[calc(-50%+0.875rem)] top-[9px] h-0.5 rounded-full",
                    "md:static md:mx-2 md:min-w-4 md:flex-1",
                    i < current || finished ? "bg-primary" : "bg-muted-foreground/20",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
