"use client";

import { cn } from "@/lib/utils";

/**
 * The progress bar of a multi-step form (shared page conventions, change 1):
 * every step on one line, numbered, with the current one underlined. Each
 * step is a button, so a form can let its steps be visited in any order.
 */
export function Stepper({
  steps,
  current,
  onStep,
}: {
  steps: string[];
  /** 1-based, like the steps' numbers. */
  current: number;
  onStep?: (step: number) => void;
}) {
  return (
    <nav
      aria-label="Progress"
      className="min-w-0"
    >
      <ol className="flex">
        {steps.map((label, i) => {
          const step = i + 1;
          const isCurrent = step === current;
          const done = step < current;
          return (
            <li key={label} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onStep?.(step)}
                aria-label={`${step} - ${label}`}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex w-full flex-col items-center gap-2 rounded-t-md px-1 pt-1.5 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm",
                  isCurrent
                    ? "font-semibold text-primary"
                    : done
                      ? "text-foreground hover:text-primary"
                      : "text-muted-foreground hover:text-foreground",
                )}
              >
                {/* On a phone, the number; the heading below names the step. */}
                <span className="sm:hidden">{step}</span>
                <span className="hidden w-full truncate text-center sm:block">
                  {step} - {label}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-1 w-full rounded-full transition-colors",
                    isCurrent
                      ? "bg-primary"
                      : done
                        ? "bg-primary/35"
                        : "bg-muted",
                  )}
                />
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
