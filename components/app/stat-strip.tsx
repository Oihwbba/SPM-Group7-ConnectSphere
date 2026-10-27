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
  /** A value that is good or bad news: green or red instead of the primary colour. */
  tone?: "success" | "danger";
  /** A list or longer text, in normal weight rather than bold and coloured. */
  plain?: boolean;
};

/**
 * The key facts of something, side by side and split by thin lines, each a
 * round icon, a label and a bold primary-coloured value (shared page conventions). On a
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
      {stats.map(({ icon: Icon, label, value, hint, testId: valueTestId, tone, plain }) => (
        <div key={label} className="flex min-w-0 items-center gap-3 py-3 sm:px-5 sm:first:pl-0 sm:last:pr-0">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd
              className={cn(
                "break-words leading-snug",
                plain
                  ? "text-sm font-normal text-foreground"
                  : "text-lg font-bold text-primary",
                tone === "success" && "text-success",
                tone === "danger" && "text-destructive",
              )}
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
