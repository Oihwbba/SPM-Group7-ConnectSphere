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
  XCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import type { Event } from "@prisma/client";

import { formatDate, formatDateTimeInTimezone } from "@/lib/datetime";
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

type FilterTab = "ALL" | "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "UNDER_REVIEW";
type SortField = "name" | "status" | "startAt" | "updatedAt";
type SortOrder = "asc" | "desc";

/**
 * EventsClient provides the interactive event list UI for Organisers and Coordinators.
 */
export function EventsClient({
  events,
  isCoordinator = false,
}: EventsClientProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<Event | null>(null);
  const [viewingEvent, setViewingEvent] = useState<Event | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [rejectingEvent, setRejectingEvent] = useState<Event | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder(field === "name" ? "asc" : "desc");
    }
  }

  function changeStatus(
    event: Event,
    nextStatus: "APPROVED" | "REJECTED",
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

  const [searchQuery, setSearchQuery] = useState("");

  const filteredEvents = events
    .filter((evt) => {
      const matchesTab =
        activeTab === "DRAFT"
          ? evt.status === "DRAFT"
          : activeTab === "SUBMITTED"
            ? evt.status === "SUBMITTED"
            : activeTab === "APPROVED"
              ? evt.status === "APPROVED"
              : activeTab === "REJECTED"
                ? evt.status === "REJECTED"
                : activeTab === "UNDER_REVIEW"
                  ? evt.status === "UNDER_REVIEW"
                  : true;

      const matchesDropdown =
        statusFilter === "ALL" ? true : evt.status === statusFilter;

      const matchesSearch =
        !searchQuery.trim() ||
        evt.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (evt.purpose && evt.purpose.toLowerCase().includes(searchQuery.toLowerCase().trim()));

      return matchesTab && matchesDropdown && matchesSearch;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === "status") {
        comparison = a.status.localeCompare(b.status);
      } else if (sortField === "startAt") {
        const tA = a.startAt ? new Date(a.startAt).getTime() : 0;
        const tB = b.startAt ? new Date(b.startAt).getTime() : 0;
        comparison = tA - tB;
      } else if (sortField === "updatedAt") {
        const tA = new Date(a.updatedAt).getTime();
        const tB = new Date(b.updatedAt).getTime();
        comparison = tA - tB;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  const draftCount = events.filter((evt) => evt.status === "DRAFT").length;
  const submittedCount = events.filter((evt) => evt.status === "SUBMITTED").length;
  const approvedCount = events.filter((evt) => evt.status === "APPROVED").length;
  const rejectedCount = events.filter((evt) => evt.status === "REJECTED").length;

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

      {/* Filter Tabs & Interactive Search Bar for SCRUM-84 AC6-AC9 */}
      {events.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="mr-1 h-4 w-4 text-muted-foreground" />
            <Button
              variant={activeTab === "ALL" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-xs font-medium"
              onClick={() => {
                setActiveTab("ALL");
                setStatusFilter("ALL");
              }}
            >
              All ({events.length})
            </Button>
            {!isCoordinator && (
              <Button
                variant={activeTab === "DRAFT" ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 gap-1.5 text-xs font-medium",
                  activeTab === "DRAFT" && "font-semibold",
                )}
                onClick={() => {
                  setActiveTab("DRAFT");
                  setStatusFilter("ALL");
                }}
              >
                <FileEdit className="h-3.5 w-3.5" />
                Drafts ({draftCount})
              </Button>
            )}
            <Button
              variant={activeTab === "SUBMITTED" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-xs font-medium"
              onClick={() => {
                setActiveTab("SUBMITTED");
                setStatusFilter("ALL");
              }}
            >
              Submitted ({submittedCount})
            </Button>
            <Button
              variant={activeTab === "APPROVED" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-xs font-medium"
              onClick={() => {
                setActiveTab("APPROVED");
                setStatusFilter("ALL");
              }}
            >
              Approved ({approvedCount})
            </Button>
            <Button
              variant={activeTab === "REJECTED" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-xs font-medium"
              onClick={() => {
                setActiveTab("REJECTED");
                setStatusFilter("ALL");
              }}
            >
              Rejected ({rejectedCount})
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full max-w-sm">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Filter by status"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="PLANNING">Planning</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <input
              type="text"
              aria-label="Search by name or purpose"
              placeholder="Search by name or purpose..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
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
              No requests match the selected filters.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 text-xs"
              onClick={() => {
                setActiveTab("ALL");
                setStatusFilter("ALL");
                setSearchQuery("");
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    aria-sort={
                      sortField === "name"
                        ? sortOrder === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort("name")}
                      aria-label="Sort by Name"
                      className="flex items-center gap-1.5 font-semibold focus:outline-none focus:ring-1 focus:ring-ring rounded px-1 py-0.5 hover:bg-muted/50 transition-colors"
                    >
                      <span>Name</span>
                      {sortField === "name" ? (
                        sortOrder === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-40 hover:opacity-100" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead
                    aria-sort={
                      sortField === "status"
                        ? sortOrder === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort("status")}
                      aria-label="Sort by Status"
                      className="flex items-center gap-1.5 font-semibold focus:outline-none focus:ring-1 focus:ring-ring rounded px-1 py-0.5 hover:bg-muted/50 transition-colors"
                    >
                      <span>Status</span>
                      {sortField === "status" ? (
                        sortOrder === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-40 hover:opacity-100" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead
                    aria-sort={
                      sortField === "startAt"
                        ? sortOrder === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort("startAt")}
                      aria-label="Sort by Starts"
                      className="flex items-center gap-1.5 font-semibold focus:outline-none focus:ring-1 focus:ring-ring rounded px-1 py-0.5 hover:bg-muted/50 transition-colors"
                    >
                      <span>Starts</span>
                      {sortField === "startAt" ? (
                        sortOrder === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-40 hover:opacity-100" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead
                    aria-sort={
                      sortField === "updatedAt"
                        ? sortOrder === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort("updatedAt")}
                      aria-label="Sort by Updated"
                      className="flex items-center gap-1.5 font-semibold focus:outline-none focus:ring-1 focus:ring-ring rounded px-1 py-0.5 hover:bg-muted/50 transition-colors"
                    >
                      <span>Updated</span>
                      {sortField === "updatedAt" ? (
                        sortOrder === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-40 hover:opacity-100" />
                      )}
                    </button>
                  </TableHead>
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
                        {event.startAt ? formatDateTimeInTimezone(event.startAt, event.timezone) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(event.updatedAt || event.createdAt)}
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
                          {/* SCRUM-19: decide a submitted or under-review request.
                              There is no manual "claim" — SCRUM-20 assigns automatically. */}
                          {isCoordinator &&
                            (event.status === "SUBMITTED" ||
                              event.status === "UNDER_REVIEW") && (
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
