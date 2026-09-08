import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Base badge. Note the extra semantic variants (success/warning/info) beyond
 * the shadcn defaults — the nine-status <StatusBadge/> maps onto these so no
 * component ever picks a raw colour. All colours read from tokens.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/10 text-primary ring-1 ring-inset ring-primary/20",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/25",
        success:
          "border-transparent bg-success/10 text-success ring-1 ring-inset ring-success/25",
        warning:
          "border-transparent bg-warning/15 text-warning-foreground ring-1 ring-inset ring-warning/30",
        info: "border-transparent bg-info/10 text-info ring-1 ring-inset ring-info/25",
        outline: "text-foreground",
        muted:
          "border-transparent bg-muted text-muted-foreground ring-1 ring-inset ring-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
