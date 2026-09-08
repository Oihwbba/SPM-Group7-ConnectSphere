import { EventStatus } from "@prisma/client";

import { Badge, type BadgeProps } from "@/components/ui/badge";

/**
 * Renders any of the nine event statuses as a coloured pill. This is the ONLY
 * place a status is turned into a colour and label — feature developers import
 * this rather than choosing a colour per screen, so a status looks identical
 * everywhere. Colours come from Badge variants, which come from tokens.
 */
const STATUS_META: Record<
  EventStatus,
  { label: string; variant: NonNullable<BadgeProps["variant"]> }
> = {
  DRAFT: { label: "Draft", variant: "muted" },
  SUBMITTED: { label: "Submitted", variant: "info" },
  UNDER_REVIEW: { label: "Under Review", variant: "info" },
  APPROVED: { label: "Approved", variant: "success" },
  PLANNING: { label: "Planning", variant: "default" },
  CONFIRMED: { label: "Confirmed", variant: "success" },
  COMPLETED: { label: "Completed", variant: "secondary" },
  CANCELLED: { label: "Cancelled", variant: "muted" },
  REJECTED: { label: "Rejected", variant: "destructive" },
};

export function StatusBadge({ status }: { status: EventStatus }) {
  const meta = STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
