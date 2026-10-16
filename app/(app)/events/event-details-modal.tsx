"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/events/status-badge";
import { ClarificationPanel } from "@/components/events/clarification-panel";
import { ChangeRequestPanel } from "@/components/events/change-request-panel";
import { ReadinessChecklist } from "@/components/events/readiness-checklist";
import { ReconsiderationPanel } from "@/components/events/reconsideration-panel";
import { ConfirmedArrangements } from "@/components/events/confirmed-arrangements";
import {
  OrganiserEquipmentAnswer,
  OrganiserVenueAnswers,
} from "@/components/events/organiser-answers";
import { EditDetailsDialog } from "@/components/events/edit-details-dialog";
import { OperationalNotes } from "@/components/events/operational-notes";
import { formatDate, formatDateTime } from "@/lib/datetime";
import {
  Calendar,
  Building2,
  Wrench,
  ClipboardList,
  Info,
  AlertTriangle,
} from "lucide-react";
import type { Event } from "@prisma/client";
import { REJECTION_OUTCOME_LABEL } from "@/lib/schemas/event";

interface EventDetailsModalProps {
  event: Event | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** True when opened from the Coordinator's view; controls whether the
   * clarification panel shows a response box (SCRUM-18). Defaults to false
   * so the Organiser's existing usage needs no changes. */
  isCoordinator?: boolean;
  isNoLongerAvailable?: boolean;
}

/**
 * EventDetailsModal displays all entered details of a submitted event request on a singular page.
 * Allows organisers to review complete request specifications without step navigation.
 */
export function EventDetailsModal({
  event,
  open,
  onOpenChange,
  isCoordinator = false,
  isNoLongerAvailable = false,
}: EventDetailsModalProps) {
  // Resolving a flag changes the readiness checklist, so it is read again.
  const [resolutions, setResolutions] = useState(0);
  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 pr-8">
            <div>
              <DialogTitle className="text-xl font-bold">
                {event.name}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs text-muted-foreground">
                {event.status === "DRAFT"
                  ? "Draft Event Request"
                  : "Event Request"}{" "}
                &mdash; Created on {formatDate(event.createdAt)}
                {event.submittedAt &&
                  ` • Submitted ${formatDate(event.submittedAt)}`}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* SCRUM-25: offered only to the assigned Coordinator. */}
              {isCoordinator && <EditDetailsDialog event={event} />}
              <StatusBadge status={event.status} />
            </div>
          </div>
        </DialogHeader>

        {/* Warning if event was reassigned or removed from review queue during view */}
        {isNoLongerAvailable && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/15 px-3 py-2 text-xs font-medium text-warning-foreground"
            data-testid="event-no-longer-available-warning"
          >
            <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-warning" />
            <span>
              This event request is no longer available in your view (it may have been reassigned or updated).
            </span>
          </div>
        )}

        {/* Singular Page Layout — Displays all entered details at a glance */}
        <div className="space-y-4 py-2">
          {/* Section 1: Basic Event Information */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/30 px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Info className="h-4 w-4 text-primary" /> Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 text-xs">
              <div>
                <span className="font-semibold text-muted-foreground">
                  Event Purpose:
                </span>
                <p className="mt-0.5 text-foreground">{event.purpose || "—"}</p>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground">
                  Event Description:
                </span>
                <p className="mt-0.5 whitespace-pre-wrap text-foreground">
                  {event.description || "—"}
                </p>
              </div>
                        </CardContent>
          </Card>

          {/* SCRUM-25 AC6: shows nothing to a user who may not read them */}
          <OperationalNotes eventId={event.id} />

          {/* SCRUM-18: shows nothing if there's no clarification thread */}
          <ClarificationPanel event={event} isCoordinator={isCoordinator} />

          {/* SCRUM-41: shows nothing for an event with none that can't take one */}
          {event.status !== "DRAFT" && (
            <ChangeRequestPanel key={event.id} event={event} />
          )}

          {/* SCRUM-110: what is still outstanding before the event can be confirmed */}
          {/* SCRUM-26: flagged arrangements, for the assigned Coordinator to resolve */}
          {(event.status === "PLANNING" || event.status === "CONFIRMED") && (
            <ReconsiderationPanel
              eventId={event.id}
              onResolved={() => setResolutions((n) => n + 1)}
            />
          )}
          {event.status === "PLANNING" && (
            <ReadinessChecklist key={resolutions} eventId={event.id} />
          )}
          {/* SCRUM-81: what a Confirmed event has secured */}
          {event.status === "CONFIRMED" && <ConfirmedArrangements eventId={event.id} />}

          {event.status === "REJECTED" && event.decisionReason && (
            <Card className="overflow-hidden">
              <CardHeader className="bg-destructive/5 px-4 py-3">
                <CardTitle className="text-sm font-semibold text-destructive">
                  Rejection reason
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-4 text-xs">
                <p className="whitespace-pre-wrap">{event.decisionReason}</p>
                {/* SCRUM-126 AC5: what the Coordinator said happens next. */}
                {event.rejectionOutcome && (
                  <p data-testid="rejection-outcome">
                    <span className="font-semibold">Next step:</span>{" "}
                    {REJECTION_OUTCOME_LABEL[event.rejectionOutcome]}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Section 2: Schedule & Expected Attendance */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/30 px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Calendar className="h-4 w-4 text-primary" /> Schedule &
                Attendance
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 p-4 text-xs sm:grid-cols-3">
              <div>
                <span className="font-semibold text-muted-foreground">
                  Proposed Start:
                </span>
                <p className="mt-0.5 text-foreground">
                  {event.startAt ? formatDateTime(event.startAt) : "—"}
                </p>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground">
                  Proposed End:
                </span>
                <p className="mt-0.5 text-foreground">
                  {event.endAt ? formatDateTime(event.endAt) : "—"}
                </p>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground">
                  Expected Attendance:
                </span>
                <p className="mt-0.5 font-medium text-foreground">
                  {event.expectedAttendance
                    ? `${event.expectedAttendance} attendees`
                    : "—"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Venue, Layout & Accessibility Requirements */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/30 px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="h-4 w-4 text-primary" /> Venue &
                Accessibility Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {/* SCRUM-170 AC5: the Organiser's answers exactly as entered, the
                  same for every event. Required Facilities is not shown: the
                  Coordinator enters facilities on each venue request. */}
              <OrganiserVenueAnswers answers={event} />
            </CardContent>
          </Card>

          {/* Section 4: Equipment & Technical Support */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/30 px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Wrench className="h-4 w-4 text-primary" /> Equipment &
                Technical Support
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <OrganiserEquipmentAnswer
                equipmentRequirements={event.equipmentRequirements}
              />
            </CardContent>
          </Card>

          {/* Section 5: Registration & Additional Details */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/30 px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardList className="h-4 w-4 text-primary" /> Registration
                & Additional Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 text-xs">
              <div>
                <span className="font-semibold text-muted-foreground">
                  Registration Needs:
                </span>
                <p className="mt-0.5 text-foreground">
                  {event.registrationNotes || "—"}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <span className="font-semibold text-muted-foreground">
                    Event Programme:
                  </span>
                  <p className="mt-0.5 text-foreground">
                    {event.programme || "Not specified"}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">
                    Special Requests:
                  </span>
                  <p className="mt-0.5 text-foreground">
                    {event.specialRequests || "None"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="border-t pt-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
