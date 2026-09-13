"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Eye,
  CalendarPlus,
  FileEdit,
  Filter,
  CheckCircle2,
  SearchCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { Event } from "@prisma/client";

import { formatDate, formatDateTime } from "@/lib/datetime";
import { StatusBadge } from "@/components/events/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateEventDialog } from "./create-event-dialog";
import { EventDetailsModal } from "./event-details-modal";
import { transitionEventStatus } from "./actions";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EventsClientProps {
  events: Event[];
  isCoordinator?: boolean;
}

type FilterTab = "ALL" | "DRAFT" | "SUBMITTED";

/**
 * EventsClient provides the interactive event list UI for Organisers and Coordinators.
 *
 * User Story 16 — Distinguish drafts from submitted requests:
 * - Draft requests feature a prominent visual "Draft — Incomplete" tag alongside their title.
 * - Table rows for drafts have a distinct muted left-border accent.
 * - Muted status badges with FileEdit icons separate DRAFT from SUBMITTED / UNDER_REVIEW (blue info pills with clock/send icons).
 * - "Resume Draft" primary action button visually separates draft rows from "View Details" on submitted requests.
 * - Quick status filter tabs allow filtering between All, Drafts, and Submitted requests.
 */
export function EventsClient({
  events,
  isCoordinator = false,
}: EventsClientProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<Event | null>(null);
  const [viewingEvent, setViewingEvent] = useState<Event | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [rejectingEvent, setRejectingEvent] = useState<Event | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function changeStatus(
    event: Event,
    nextStatus: "UNDER_REVIEW" | "APPROVED" | "REJECTED",
    decisionReason?: string,
  ) {
    startTransition(async () => {
      const result = await transitionEventStatus({
        eventId: event.id,
        nextStatus,
        decisionReason,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Event status updated to ${result.data.status.replace("_", " ").toLowerCase()}.`,
      );
      setRejectingEvent(null);
      setRejectionReason("");
      router.refresh();
    });
  }

  const filteredEvents = events.filter((evt) => {
    if (activeTab === "DRAFT") return evt.status === "DRAFT";
    if (activeTab === "SUBMITTED") return evt.status !== "DRAFT";
    return true;
  });

  const draftCount = events.filter((evt) => evt.status === "DRAFT").length;
  const submittedCount = events.filter((evt) => evt.status !== "DRAFT").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isCoordinator ? "Submitted Event Requests" : "My Events"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isCoordinator
              ? "Review submitted event requests requiring coordinator review and planning."
              : "Create and track your event requests through their lifecycle."}
          </p>
        </div>
        {!isCoordinator && (
          <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Event Request
          </Button>
        )}
      </div>

      {/* Filter Tabs for Organisers to toggle between All, Drafts, and Submitted Requests */}
      {!isCoordinator && events.length > 0 && (
        <div className="flex items-center gap-2 border-b pb-3">
          <Filter className="mr-1 h-4 w-4 text-muted-foreground" />
          <Button
            variant={activeTab === "ALL" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 text-xs font-medium"
            onClick={() => setActiveTab("ALL")}
          >
            All Requests ({events.length})
          </Button>
          <Button
            variant={activeTab === "DRAFT" ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "h-8 gap-1.5 text-xs font-medium",
              activeTab === "DRAFT" && "font-semibold",
            )}
            onClick={() => setActiveTab("DRAFT")}
          >
            <FileEdit className="h-3.5 w-3.5" />
            Drafts ({draftCount})
          </Button>
          <Button
            variant={activeTab === "SUBMITTED" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 text-xs font-medium"
            onClick={() => setActiveTab("SUBMITTED")}
          >
            Submitted ({submittedCount})
          </Button>
        </div>
      )}

      {events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CalendarPlus className="h-6 w-6" />
            </span>
            <p className="text-base font-medium">
              {isCoordinator ? "No submitted event requests" : "No events yet"}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {isCoordinator
                ? "There are currently no submitted event requests waiting for review."
                : "Create your first draft event to get started. You can complete the details and submit it for review later."}
            </p>
            {!isCoordinator && (
              <div className="pt-2">
                <Button
                  className="gap-2"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Create Event Request
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : filteredEvents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              No requests match the selected filter ({activeTab.toLowerCase()}).
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 text-xs"
              onClick={() => setActiveTab("ALL")}
            >
              Clear Filter
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Starts</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => {
                  const isDraft = event.status === "DRAFT";
                  const isRejected = event.status === "REJECTED";
                  return (
                    <TableRow
                      key={event.id}
                      data-status={event.status}
                      data-testid={
                        isDraft ? "draft-event-row" : "submitted-event-row"
                      }
                      className={cn(
                        "transition-colors",
                        isDraft
                          ? "border-l-4 border-l-muted-foreground/50 bg-muted/40"
                          : "border-l-4 border-l-transparent",
                      )}
                    >
                      <TableCell className="font-medium">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setViewingEvent(event)}
                            className="cursor-pointer text-left font-medium text-foreground hover:underline focus:outline-none"
                            data-testid="event-name-link"
                          >
                            {event.name}
                          </button>
                          {/* User Story 16: Draft requests are visually marked with a clear Draft label tag */}
                          {isDraft && (
                            <span
                              className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                              data-testid="draft-label"
                            >
                              <FileEdit className="h-3 w-3" />
                              Draft — Incomplete
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={event.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {event.startAt ? formatDateTime(event.startAt) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(event.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(isDraft || (!isCoordinator && isRejected)) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 text-xs font-medium"
                              onClick={() => setEditingDraft(event)}
                              data-testid={
                                isDraft
                                  ? "resume-draft-button"
                                  : "amend-rejected-button"
                              }
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              {isDraft ? "Resume Draft" : "Amend & Resubmit"}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => setViewingEvent(event)}
                            data-testid="view-details-button"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View Details
                          </Button>
                          {isCoordinator && event.status === "SUBMITTED" && (
                            <Button
                              size="sm"
                              className="h-8 gap-1.5 text-xs"
                              disabled={isPending}
                              onClick={() =>
                                changeStatus(event, "UNDER_REVIEW")
                              }
                            >
                              <SearchCheck className="h-3.5 w-3.5" /> Start
                              Review
                            </Button>
                          )}
                          {isCoordinator && event.status === "UNDER_REVIEW" && (
                            <>
                              <Button
                                size="sm"
                                className="h-8 gap-1.5 text-xs"
                                disabled={isPending}
                                onClick={() => changeStatus(event, "APPROVED")}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 gap-1.5 text-xs"
                                disabled={isPending}
                                onClick={() => {
                                  setRejectingEvent(event);
                                  setRejectionReason("");
                                }}
                              >
                                <XCircle className="h-3.5 w-3.5" /> Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Controlled Dialog Instance for Creating New Event */}
      <CreateEventDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {/* Controlled Dialog Instance for Editing/Resuming Draft */}
      {editingDraft && (
        <CreateEventDialog
          key={editingDraft.id}
          open={!!editingDraft}
          onOpenChange={(open) => {
            if (!open) setEditingDraft(null);
          }}
          draftEvent={editingDraft}
        />
      )}

      {/* Controlled Singular-Page Modal for Viewing Submitted Event Details */}
      {viewingEvent && (
        <EventDetailsModal
          open={!!viewingEvent}
          onOpenChange={(open) => {
            if (!open) setViewingEvent(null);
          }}
          event={viewingEvent}
        />
      )}

      <Dialog
        open={!!rejectingEvent}
        onOpenChange={(open) => !open && setRejectingEvent(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject event request</DialogTitle>
            <DialogDescription>
              Give the organiser a clear reason so they can amend and resubmit
              the request.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="Reason for rejection"
            aria-label="Rejection reason"
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRejectingEvent(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending || !rejectionReason.trim()}
              onClick={() =>
                rejectingEvent &&
                changeStatus(rejectingEvent, "REJECTED", rejectionReason)
              }
            >
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
