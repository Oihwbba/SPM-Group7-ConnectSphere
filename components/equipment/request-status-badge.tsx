import type { EquipmentRequestStatus } from "@prisma/client";
import {
  AlertCircle,
  Check,
  Clock,
  Search,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { EQUIPMENT_REQUEST_STATUS_LABEL } from "@/lib/equipment/requests";

const STATUS_STYLE: Record<
  EquipmentRequestStatus,
  { variant: NonNullable<BadgeProps["variant"]>; icon: LucideIcon }
> = {
  PENDING_REVIEW: { variant: "info", icon: Clock },
  IN_REVIEW: { variant: "warning", icon: Search },
  APPROVED: { variant: "success", icon: Check },
  REJECTED: { variant: "destructive", icon: XCircle },
  CANCELLED: { variant: "muted", icon: AlertCircle },
};

/** SCRUM-27/28 — an equipment request's status, in the stories' own words. */
export function RequestStatusBadge({
  status,
}: {
  status: EquipmentRequestStatus;
}) {
  const { variant, icon: Icon } = STATUS_STYLE[status];

  return (
    <Badge
      variant={variant}
      className="inline-flex shrink-0 items-center gap-1"
      data-status={status}
      data-testid="request-status"
    >
      <Icon className="h-3 w-3" />
      <span>{EQUIPMENT_REQUEST_STATUS_LABEL[status]}</span>
    </Badge>
  );
}
