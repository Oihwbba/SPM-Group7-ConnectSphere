"use client";

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
import { formatDate, formatDateTime } from "@/lib/datetime";
import { Calendar, Building2, Wrench, ClipboardList, Info } from "lucide-react";
import type { Event } from "@prisma/client";

interface EventDetailsModalProps {
  event: Event | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** True when opened from the Coordinator's view; controls whether the
   * clarification panel shows a response box (SCRUM-18). Defaults to false
   * so the Organiser's existing usage needs no changes. */
  isCoordinator?: boolean;
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
}: EventDetailsModalProps) {
  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
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
            <StatusBadge status={event.status} />
          </div>
        </DialogHeader>

        {/* Singular Page Layout — Displays all entered details at a glance */}
        <div className="space-y-4 py-2">
          {/* Section 1: Basic Event Information */}
          <Card>
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

          {/* SCRUM-18: shows nothing if there's no clarification thread */}
          <ClarificationPanel eventId={event.id} isCoordinator={isCoordinator} />

          {event.status === "REJECTED" && event.decisionReason && (
            <Card>
              <CardHeader className="bg-destructive/5 px-4 py-3">
                <CardTitle className="text-sm font-semibold text-destructive">
                  Rejection reason
                </CardTitle>
              </CardHeader>
              <CardContent className="whitespace-pre-wrap p-4 text-xs">
                {event.decisionReason}
              </CardContent>
            </Card>
          )}

          {/* Section 2: Schedule & Expected Attendance */}
          <Card>
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
          <Card>
            <CardHeader className="bg-muted/30 px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="h-4 w-4 text-primary" /> Venue &
                Accessibility Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <span className="font-semibold text-muted-foreground">
                    Venue Requirements:
                  </span>
                  <p className="mt-0.5 text-foreground">
                    {event.venueRequirements || "—"}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">
                    Preferred Room Layout:
                  </span>
                  <p className="mt-0.5 font-medium text-foreground">
                    {event.preferredLayout || "—"}
                  </p>
                </div>
              </div>
              {event.requiredFacilities &&
                event.requiredFacilities.length > 0 && (
                  <div>
                    <span className="font-semibold text-muted-foreground">
                      Required Facilities:
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {event.requiredFacilities.map((facility) => (
                        <span
                          key={facility}
                          className="rounded border bg-primary/10 px-2 py-0.5 text-[11px] font-medium capitalize text-primary"
                        >
                          {facility.replace("-", " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              <div>
                <span className="font-semibold text-muted-foreground">
                  Accessibility Needs:
                </span>
                <p className="mt-0.5 text-foreground">
                  {event.accessibilityNeeds || "—"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Equipment & Technical Support */}
          <Card>
            <CardHeader className="bg-muted/30 px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Wrench className="h-4 w-4 text-primary" /> Equipment &
                Technical Support
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-xs">
              <span className="font-semibold text-muted-foreground">
                Equipment Requirements:
              </span>
              <p className="mt-0.5 whitespace-pre-wrap text-foreground">
                {event.equipmentRequirements || "—"}
              </p>
            </CardContent>
          </Card>

          {/* Section 5: Registration & Additional Details */}
          <Card>
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
