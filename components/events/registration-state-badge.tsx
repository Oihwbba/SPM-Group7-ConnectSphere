import type { RegistrationStatus } from "@prisma/client";
import {
  Ban,
  CheckCircle2,
  Clock,
  Lock,
  PauseCircle,
  Ticket,
  Undo2,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { ShownRegistrationState } from "@/lib/registration-summary";

/** Every registration badge an Attendee sees: an event's state, or their own registration's. */
export type RegistrationBadgeKind =
  | ShownRegistrationState
  | RegistrationStatus
  | "PAUSED";

const STYLE: Record<
  RegistrationBadgeKind,
  { variant: NonNullable<BadgeProps["variant"]>; icon: LucideIcon }
> = {
  REGISTERED: { variant: "success", icon: CheckCircle2 },
  OPEN: { variant: "info", icon: Ticket },
  FULL: { variant: "destructive", icon: Ban },
  NOT_YET_OPEN: { variant: "warning", icon: Clock },
  CLOSED: { variant: "muted", icon: Lock },
  PAUSED: { variant: "warning", icon: PauseCircle },
  WITHDRAWN: { variant: "muted", icon: Undo2 },
  CANCELLED: { variant: "destructive", icon: XCircle },
};

/**
 * SCRUM-212 AC1, SCRUM-207 AC2 — registration on an Attendee's pages, in the
 * shared badge: one colour and icon per state, the same on every page.
 */
export function RegistrationStateBadge({
  kind,
  label,
  testId = "registration-state-badge",
}: {
  kind: RegistrationBadgeKind;
  label: string;
  testId?: string;
}) {
  const { variant, icon: Icon } = STYLE[kind];

  return (
    <Badge
      variant={variant}
      className="inline-flex shrink-0 items-center gap-1"
      data-state={kind}
      data-testid={testId}
    >
      <Icon className="h-3 w-3" />
      <span>{label}</span>
    </Badge>
  );
}
