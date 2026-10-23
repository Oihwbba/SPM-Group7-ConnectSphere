import type { EquipmentRequestStatus } from "@prisma/client";

import {
  ArrowRightLeft,
  CheckCircle2,
  MessageSquare,
  Send,
  XCircle,
} from "lucide-react";

import type { TrailEntry } from "@/components/app/audit-trail";
import { EQUIPMENT_REQUEST_STATUS_LABEL } from "@/lib/equipment/requests";

export type Entry = {
  id: string;
  createdAt: Date;
  fromStatus: EquipmentRequestStatus | null;
  toStatus: EquipmentRequestStatus | null;
  note: string | null;
  actor: { name: string | null };
};

/** What an entry changed, in words: a status move, or a note on its own. */
function describe(entry: Entry): string | null {
  const to = entry.toStatus && EQUIPMENT_REQUEST_STATUS_LABEL[entry.toStatus];
  if (!to) return null;
  if (!entry.fromStatus) return `Submitted as ${to}`;
  return `${EQUIPMENT_REQUEST_STATUS_LABEL[entry.fromStatus]} → ${to}`;
}

/**
 * SCRUM-28 AC 6 — "a chronological history log of all updates made", oldest
 * first, as the timeline shows it: what moved, who, when and why.
 */
export function trailOf(entries: Entry[]): TrailEntry[] {
  return entries.map((entry) => ({
    id: entry.id,
    at: entry.createdAt,
    title: describe(entry),
    by: entry.actor.name,
    note: entry.note,
    icon:
      entry.toStatus === "APPROVED"
        ? CheckCircle2
        : entry.toStatus === "REJECTED" || entry.toStatus === "CANCELLED"
          ? XCircle
          : !entry.fromStatus
            ? Send
            : entry.toStatus
              ? ArrowRightLeft
              : MessageSquare,
    tone:
      entry.toStatus === "APPROVED"
        ? "success"
        : entry.toStatus === "REJECTED" || entry.toStatus === "CANCELLED"
          ? "danger"
          : entry.toStatus
            ? "info"
            : "default",
  }));
}
