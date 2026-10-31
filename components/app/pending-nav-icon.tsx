"use client";

import { useLinkStatus } from "next/link";
import { Loader2, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * SCRUM-207 — a menu link's icon, replaced by a spinner while the page it
 * opens is loading. Pages have no loading skeleton, so the current page stays
 * on screen until the next is ready; this shows the click was taken.
 * Must be rendered inside the link (`useLinkStatus` reads the nearest one).
 */
export function PendingNavIcon({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className: string;
}) {
  const { pending } = useLinkStatus();
  if (pending) {
    return (
      <Loader2
        aria-hidden
        data-pending=""
        className={cn(className, "motion-safe:animate-spin")}
      />
    );
  }
  return <Icon aria-hidden className={className} />;
}
