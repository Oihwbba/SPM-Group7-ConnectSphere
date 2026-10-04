"use client";

import { useState, useEffect, useTransition } from "react";
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
  MessageCircleQuestion,
  CopyPlus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import type { Event, RejectionOutcome } from "@prisma/client";

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
import styles from "./events-list.module.css";
import { CreateEventDialog } from "./create-event-dialog";
import { EventDetailsModal } from "./event-details-modal";
import { startRequestFromRejected, transitionEventStatus } from "./actions";
import { REJECTION_OUTCOME_LABEL } from "@/lib/schemas/event";
import { requestClarification } from "./clarification-actions";
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

export type FilterTab = "ALL" | "DRAFT" | "SUBMITTED";
export type SortField = "name" | "status" | "startAt" | "updatedAt";
export type SortOrder = "asc" | "desc";

export interface FilterAndSortOptions {
  activeTab?: FilterTab;
  statusFilter?: string;
  searchQuery?: string;
  sortField?: SortField;
  sortOrder?: SortOrder;
  /** What the second tab means. An organiser wants everything they have sent
   * ("non-draft"); a coordinator wants the queue they can still act on
   * ("awaiting-review"), since Approve, Ask and Reject only render on those
   * two statuses. */
  submittedMeans?: "non-draft" | "awaiting-review";
}

/** The statuses a coordinator can still decide on (SCRUM-19). */
export const AWAITING_REVIEW = ["SUBMITTED", "UNDER_REVIEW"];

export function filterAndSortEvents<
  T extends {
    name: string;
    status: string;
    purpose?: string | null;
    startAt?: Date | string | null;
    updatedAt?: Date | string | null;
    createdAt?: Date | string | null;
  },
>(events: T[], options: FilterAndSortOptions = {}): T[] {
  const {
    activeTab = "ALL",
    statusFilter = "ALL",
    searchQuery = "",
    sortField = "updatedAt",
    sortOrder = "desc",
    submittedMeans = "non-draft",
  } = options;

  const q = searchQuery.trim().toLowerCase();

  return events
    .filter((evt) => {
      // SCRUM-20 auto-assigns on submission, so a tab scoped to SUBMITTED alone
      // would hide a request the moment it is sent. For an organiser the tab is
      // therefore everything that is not a draft; for a coordinator it is the
      // queue they can still decide on, which is what their page is for.
      const matchesTab =
        activeTab === "DRAFT"
          ? evt.status === "DRAFT"
          : activeTab === "SUBMITTED"
            ? submittedMeans === "awaiting-review"
              ? AWAITING_REVIEW.includes(evt.status)
              : evt.status !== "DRAFT"
            : true;

      const matchesDropdown =
        statusFilter === "ALL" ? true : evt.status === statusFilter;

      const matchesSearch =
        !q ||
        evt.name.toLowerCase().includes(q) ||
        Boolean(evt.purpose && evt.purpose.toLowerCase().includes(q));

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
        const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        comparison = tA - tB;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
}

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
  const [rejectionOutcome, setRejectionOutcome] =
    useState<RejectionOutcome | null>(null);
  const [clarifyingEvent, setClarifyingEvent] = useState<Event | null>(null);
  const [clarificationMessage, setClarificationMessage] = useState("");
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
  // SCRUM-24: Auto-refresh event data periodically so concurrent viewers never see conflicting statuses
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && !isPending) {
        router.refresh();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [router, isPending]);

  // Derive active event from freshly polled events list if present,
  // falling back to viewingEvent snapshot if a poll drops it (e.g. reassigned coordinator).
  const activeEvent = viewingEvent
    ? (events.find((e) => e.id === viewingEvent.id) ?? null)
    : null;
  const eventToDisplay = activeEvent ?? viewingEvent;
  const isEventNoLongerAvailable = Boolean(viewingEvent && !activeEvent);

  function changeStatus(
    event: Event,
    nextStatus: "APPROVED" | "REJECTED",
    decisionReason?: string,
    outcome?: RejectionOutcome,
  ) {
    startTransition(async () => {
      const result = await transitionEventStatus({
        eventId: event.id,
        nextStatus,
        decisionReason,
        rejectionOutcome: outcome,
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
      setRejectionOutcome(null);
      router.refresh();
    });
  }

  // SCRUM-126 AC4: a request rejected as needing a new submission becomes the
  // starting point of a new Draft, found under the Drafts tab.
  function startNewRequest(event: Event) {
    startTransition(async () => {
      const result = await startRequestFromRejected({ eventId: event.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.created
          ? "A new draft was started from this request."
          : "A draft was already started from this request. Find it under Drafts.",
      );
      // As the Drafts tab button does, so a leftover status filter can't hide it.
      setActiveTab("DRAFT");
      setStatusFilter("ALL");
      router.refresh();
    });
  }

  const [searchQuery, setSearchQuery] = useState("");

  // SCRUM-18: coordinator asks the organiser a question instead of deciding
  // yet. The event's own status is untouched.
  function submitClarification() {
    if (!clarifyingEvent || !clarificationMessage.trim()) return;
    startTransition(async () => {
      const result = await requestClarification({
        eventId: clarifyingEvent.id,
        message: clarificationMessage,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Clarification request sent to the organiser.");
      setClarifyingEvent(null);
      setClarificationMessage("");
      router.refresh();
    });
  }

  // A coordinator's second tab is their review queue; an organiser's is
  // everything they have sent. Both the filter and the count follow this.
  const submittedMeans = isCoordinator ? "awaiting-review" : "non-draft";

  const filteredEvents = filterAndSortEvents(events, {
    activeTab,
    statusFilter,
    searchQuery,
    sortField,
    sortOrder,
    submittedMeans,
  });

  const draftCount = events.filter((evt) => evt.status === "DRAFT").length;
  const submittedCount = events.filter((evt) =>
    submittedMeans === "awaiting-review"
      ? AWAITING_REVIEW.includes(evt.status)
      : evt.status !== "DRAFT",
  ).length;

  // Row actions. The row is a single element (table row on desktop, stacked
  // card on mobile — see events-list.module.css), so each control renders once
  // and its testid is unambiguous without any "mobile-" prefix.
  const renderActions = (event: Event) => {
    const isDraft = event.status === "DRAFT";
    const isRejected = event.status === "REJECTED";
    // SCRUM-126 AC2/AC3: the Coordinator's choice decides which way back the
    // Organiser is offered.
    const startsAgain = event.rejectionOutcome === "NEW_REQUEST";
    // On a phone the actions are a two-column grid of full-width, thumb-sized
    // buttons, so a fourth button no longer wraps alone onto a second line; from
    // md up they are the compact inline row the desktop table has always had.
    const actionButton = "h-10 w-full gap-1.5 text-xs md:h-8 md:w-auto";
    return (
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center md:justify-end md:gap-1.5 [&>*:only-child]:col-span-2 md:[&>*:only-child]:col-span-1">
        {(isDraft || (!isCoordinator && isRejected && !startsAgain)) && (
          <Button
            variant="outline"
            size="sm"
            className={cn(actionButton, "font-medium")}
            onClick={() => setEditingDraft(event)}
            data-testid={
              isDraft ? "resume-draft-button" : "amend-rejected-button"
            }
          >
            <Pencil className="h-3.5 w-3.5" />
            {isDraft ? "Resume Draft" : "Amend & Resubmit"}
          </Button>
        )}
        {!isCoordinator && isRejected && startsAgain && (
          <Button
            variant="outline"
            size="sm"
            className={cn(actionButton, "font-medium")}
            disabled={isPending}
            onClick={() => startNewRequest(event)}
            data-testid="start-new-request-button"
          >
            <CopyPlus className="h-3.5 w-3.5" />
            Start New Request
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={actionButton}
          onClick={() => setViewingEvent(event)}
          data-testid="view-details-button"
        >
          <Eye className="h-3.5 w-3.5" />
          View Details
        </Button>
        {/* SCRUM-19: decide a submitted or under-review request. There is no
            manual "claim" — SCRUM-20 assigns automatically. */}
        {isCoordinator &&
          (event.status === "SUBMITTED" || event.status === "UNDER_REVIEW") && (
            <>
              <Button
                size="sm"
                className={actionButton}
                disabled={isPending}
                onClick={() => changeStatus(event, "APPROVED")}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
              </Button>
              {/* SCRUM-18: ask the organiser a question instead of deciding. */}
              <Button
                variant="outline"
                size="sm"
                className={actionButton}
                disabled={isPending}
                onClick={() => {
                  setClarifyingEvent(event);
                  setClarificationMessage("");
                }}
              >
                <MessageCircleQuestion className="h-3.5 w-3.5" /> Ask
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className={actionButton}
                disabled={isPending}
                onClick={() => {
                  setRejectingEvent(event);
                  setRejectionReason("");
                  setRejectionOutcome(null);
                }}
              >
                <XCircle className="h-3.5 w-3.5" /> Reject
              </Button>
            </>
          )}
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            {isCoordinator ? "Submitted Event Requests" : "My Events"}
          </h1>
          {/* Onboarding subtitle — hidden on phones to keep the header compact
              and leave more room for the list. */}
          <p className="hidden text-sm text-muted-foreground sm:block">
            {isCoordinator
              ? "Review submitted event requests requiring coordinator review and planning."
              : "Create and track your event requests through their lifecycle."}
          </p>
        </div>
        {!isCoordinator && (
          <Button
            className="h-8 gap-1.5 px-3 text-xs md:h-10 md:gap-2 md:px-4 md:text-sm"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Create Event Request
          </Button>
        )}
      </div>

      {/* Filter Tabs & Interactive Search Bar for SCRUM-84 AC6-AC9 */}
      {events.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          {/* Horizontal scroll below md keeps the phone layout free of overflow
              (SCRUM-84 mobile e2e), wrapping normally from md up. */}
          <div className="flex w-full flex-nowrap items-center gap-1.5 overflow-x-auto md:w-auto md:flex-wrap md:gap-2 md:overflow-visible">
            <Filter className="mr-0.5 h-4 w-4 shrink-0 text-muted-foreground md:mr-1" />
            <Button
              variant={activeTab === "ALL" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 shrink-0 text-xs font-medium"
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
                  "h-8 shrink-0 gap-1.5 text-xs font-medium",
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
              className="h-8 shrink-0 text-xs font-medium"
              onClick={() => {
                setActiveTab("SUBMITTED");
                setStatusFilter("ALL");
              }}
            >
              {isCoordinator ? "Awaiting review" : "Submitted"} (
              {submittedCount})
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
        <Card className="max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:shadow-none max-md:backdrop-blur-none">
          <CardContent className="p-0">
            {/* A single table that restyles into a stacked card per row below
                the `md` breakpoint (events-list.module.css). Each event — and
                each action control — exists exactly once in the DOM; there is
                no hidden duplicate list and no "mobile-" testid split.

                Explicit ARIA roles are set because the mobile restyle changes
                the elements' `display` (block/grid), which otherwise strips a
                table's implicit table/row/cell roles from the accessibility
                tree. With the roles, a screen reader still reads it as a table
                of rows and cells on a phone. */}
            <Table role="table" className={styles.list}>
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
              <TableBody role="rowgroup">
                {filteredEvents.map((event) => {
                  const isDraft = event.status === "DRAFT";
                  return (
                    <TableRow
                      key={event.id}
                      role="row"
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
                      <TableCell
                        role="cell"
                        data-col="name"
                        className="font-medium"
                      >
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
                      <TableCell role="cell" data-col="status">
                        <StatusBadge status={event.status} />
                      </TableCell>
                      <TableCell
                        role="cell"
                        data-col="starts"
                        className="text-muted-foreground"
                      >
                        {/* On mobile the column header is gone, so carry a real
                            (screen-reader-announced) label; hidden on desktop
                            where the table header supplies it. */}
                        <span className="mb-0.5 block text-xs md:hidden">
                          Starts
                        </span>
                        {event.startAt
                          ? formatDateTime(event.startAt)
                          : "—"}
                      </TableCell>
                      <TableCell
                        role="cell"
                        data-col="created"
                        className="text-muted-foreground"
                      >
                        <span className="mb-0.5 block text-xs md:hidden">
                          Updated
                        </span>
                        {formatDate(event.updatedAt || event.createdAt)}
                      </TableCell>
                      <TableCell
                        role="cell"
                        data-col="actions"
                        className="text-right"
                      >
                        {renderActions(event)}
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
        key={createDialogOpen ? "create-open" : "create-closed"}
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
      {eventToDisplay && (
        <EventDetailsModal
          open={!!viewingEvent}
          onOpenChange={(open) => {
            if (!open) setViewingEvent(null);
          }}
          event={eventToDisplay}
          isCoordinator={isCoordinator}
          isNoLongerAvailable={isEventNoLongerAvailable}
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
              Give the organiser a clear reason, and choose whether they amend
              this request or start a new one.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="Reason for rejection"
            aria-label="Rejection reason"
          />
          {/* SCRUM-126 AC1: one outcome must be chosen with the reason. */}
          <fieldset className="space-y-2 text-sm">
            <legend className="mb-1 font-medium">
              What can the organiser do next?
            </legend>
            {(Object.keys(REJECTION_OUTCOME_LABEL) as RejectionOutcome[]).map(
              (outcome) => (
                <label key={outcome} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="rejection-outcome"
                    value={outcome}
                    checked={rejectionOutcome === outcome}
                    onChange={() => setRejectionOutcome(outcome)}
                    className="accent-primary"
                  />
                  {REJECTION_OUTCOME_LABEL[outcome]}
                </label>
              ),
            )}
          </fieldset>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRejectingEvent(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                isPending || !rejectionReason.trim() || !rejectionOutcome
              }
              onClick={() =>
                rejectingEvent &&
                rejectionOutcome &&
                changeStatus(
                  rejectingEvent,
                  "REJECTED",
                  rejectionReason,
                  rejectionOutcome,
                )
              }
            >
              {isPending ? "Rejecting…" : "Reject request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
            <Dialog
        open={!!clarifyingEvent}
        onOpenChange={(open) => !open && setClarifyingEvent(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request clarification</DialogTitle>
            <DialogDescription>
              Ask the organiser what you need before deciding. The event
              stays under review while you wait for their response.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={clarificationMessage}
            onChange={(event) => setClarificationMessage(event.target.value)}
            placeholder="What do you need clarified?"
            aria-label="Clarification message"
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setClarifyingEvent(null)}>
              Cancel
            </Button>
            <Button
              disabled={isPending || !clarificationMessage.trim()}
              onClick={submitClarification}
            >
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
