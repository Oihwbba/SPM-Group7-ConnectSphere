import { EventStatus } from "@prisma/client";
import {
  FileEdit,
  Send,
  Clock,
  CheckCircle2,
  Calendar,
  Check,
  CheckCheck,
  XCircle,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { EVENT_STATUS_LABEL } from "@/lib/status-labels";

/**
 * Renders any of the nine event statuses as a coloured pill with an icon.
 * User Story 16: Draft requests are visually marked with a muted badge and FileEdit icon,
 * making them immediately distinct at a glance.
 */
export const STATUS_META: Record<
  EventStatus,
  { label: string; variant: NonNullable<BadgeProps["variant"]>; icon: LucideIcon }
> = {
  DRAFT: { label: EVENT_STATUS_LABEL.DRAFT, variant: "muted", icon: FileEdit },
  SUBMITTED: { label: EVENT_STATUS_LABEL.SUBMITTED, variant: "info", icon: Send },
  UNDER_REVIEW: { label: EVENT_STATUS_LABEL.UNDER_REVIEW, variant: "warning", icon: Clock },
  APPROVED: { label: EVENT_STATUS_LABEL.APPROVED, variant: "success", icon: Check },
  PLANNING: { label: EVENT_STATUS_LABEL.PLANNING, variant: "default", icon: Calendar },
  CONFIRMED: { label: EVENT_STATUS_LABEL.CONFIRMED, variant: "outline", icon: CheckCircle2 },
  COMPLETED: { label: EVENT_STATUS_LABEL.COMPLETED, variant: "secondary", icon: CheckCheck },
  CANCELLED: { label: EVENT_STATUS_LABEL.CANCELLED, variant: "muted", icon: AlertCircle },
  REJECTED: { label: EVENT_STATUS_LABEL.REJECTED, variant: "destructive", icon: XCircle },
};

export function StatusBadge({ status }: { status: EventStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <Badge
      variant={meta.variant}
      className="gap-1 inline-flex items-center"
      data-status={status}
      data-testid="status-badge"
    >
      <Icon className="h-3 w-3" />
      <span>{meta.label}</span>
    </Badge>
  );
}

