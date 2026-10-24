import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type Stat = {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  /** A short line under the value, e.g. the times under a date. */
  hint?: React.ReactNode;
  /** On the value, so tests and links can find it by itself. */
  testId?: string;
};

/**
 * The key facts of something, side by side and split by thin lines, each a
 * round icon, a label and a bold violet value (shared page conventions). On a
 * phone they stack, split by lines across.
 */
export function StatStrip({
  stats,
  className,
  testId,
}: {
  stats: Stat[];
  className?: string;
  testId?: string;
}) {
  return (
    <dl
      data-testid={testId}
      className={cn(
        "grid grid-cols-1 divide-y sm:auto-cols-fr sm:grid-flow-col sm:divide-x sm:divide-y-0",
        className,
      )}
    >
      {stats.map(({ icon: Icon, label, value, hint, testId: valueTestId }) => (
        <div key={label} className="flex min-w-0 items-center gap-3 py-3 sm:px-5 sm:first:pl-0 sm:last:pr-0">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd
              className="break-words text-lg font-bold leading-snug text-violet-700 dark:text-violet-300"
              data-testid={valueTestId}
            >
              {value}
            </dd>
            {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
          </div>
        </div>
      ))}
    </dl>
  );
}
