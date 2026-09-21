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

/**
 * Renders any of the nine event statuses as a coloured pill with an icon.
 * User Story 16: Draft requests are visually marked with a muted badge and FileEdit icon,
 * making them immediately distinct at a glance from "Submitted" and "Under Review" (blue info pills with clock icons).
 */
const STATUS_META: Record<
  EventStatus,
  { label: string; variant: NonNullable<BadgeProps["variant"]>; icon: LucideIcon }
> = {
  DRAFT: { label: "Draft", variant: "muted", icon: FileEdit },
  SUBMITTED: { label: "Submitted", variant: "info", icon: Send },
  UNDER_REVIEW: { label: "Under Review", variant: "warning", icon: Clock },
  APPROVED: { label: "Approved", variant: "success", icon: Check },
  PLANNING: { label: "Planning", variant: "default", icon: Calendar },
  CONFIRMED: { label: "Confirmed", variant: "outline", icon: CheckCircle2 },
  COMPLETED: { label: "Completed", variant: "secondary", icon: CheckCheck },
  CANCELLED: { label: "Cancelled", variant: "muted", icon: AlertCircle },
  REJECTED: { label: "Rejected", variant: "destructive", icon: XCircle },
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

