"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Eye,
  CalendarPlus,
  BellRing,
  FileEdit,
  Filter,
  CopyPlus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  Send,
  Inbox,
  MessagesSquare,
} from "lucide-react";
import { toast } from "sonner";
import type { Event } from "@prisma/client";

import { formatDate, formatDateTime } from "@/lib/datetime";
import { isOverdue } from "@/lib/event-closing";
import { EVENT_STATUS_LABEL } from "@/lib/status-labels";
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
import { ReviewDecision } from "@/components/events/review-decision";
import { AppSelect } from "@/components/app/app-select";
import { SubmittedDialog } from "@/components/app/submitted-dialog";
import { discardDraftEvent, startRequestFromRejected } from "./actions";
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
  /** The requests with a clarification waiting on the Organiser's answer. */
  awaitingAnswerIds?: string[];
  /** The Organiser's events with a clarification thread, open or answered. */
  clarifiedEventIds?: string[];
  isCoordinator?: boolean;
}

export type FilterTab = "ALL" | "DRAFT" | "SUBMITTED" | "ACTION";
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
  /** Which requests the "Actions required" tab lists. */
  needsAction?: (event: { id?: string; status: string }) => boolean;
}

/**
 * Shared page conventions, change 1 — an Organiser's request waits on them
 * when it was rejected to be amended and resubmitted, or a Coordinator asked
 * a clarification they haven't answered. A request rejected for a new one
 * to be started (SCRUM-126) stays rejected, so it isn't listed.
 */
export function needsOrganiserAction(
  event: { id: string; status: string; rejectionOutcome?: string | null },
  awaitingAnswer: ReadonlySet<string>,
): boolean {
  if (awaitingAnswer.has(event.id)) return true;
  return event.status === "REJECTED" && event.rejectionOutcome !== "NEW_REQUEST";
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
    needsAction,
  } = options;

  const q = searchQuery.trim().toLowerCase();

  return events
    .filter((evt) => {
      // A submitted request moves to Under Review once the Lead assigns it
      // (SCRUM-165), so a tab scoped to SUBMITTED alone would hide it then. For
      // an organiser the tab is therefore everything that is not a draft; for
      // a coordinator it is the requests they can still decide on.
      const matchesTab =
        activeTab === "DRAFT"
          ? evt.status === "DRAFT"
          : activeTab === "ACTION"
            ? (needsAction?.(evt) ?? false)
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
  awaitingAnswerIds = [],
  clarifiedEventIds = [],
}: EventsClientProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<Event | null>(null);
  // Change 8: the request just submitted, and the one to show once the
  // refreshed list has it.
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  // Which row's Start New Request is in flight, so only that button says so.
  const [startingFrom, setStartingFrom] = useState<string | null>(null);
  // The draft just started from a rejection, opened once the refreshed list
  // has it. A request already submitted from it can't be edited, only found.
  const [draftToOpen, setDraftToOpen] = useState<string | null>(null);
  const startedDraft = draftToOpen
    ? (events.find((e) => e.id === draftToOpen && e.status === "DRAFT") ??
      null)
    : null;
  const draftInEditor = editingDraft ?? startedDraft;
  // SCRUM-130: the draft awaiting confirmation before it is discarded.
  const [discardingEvent, setDiscardingEvent] = useState<Event | null>(null);
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

  // SCRUM-126 AC4: a request rejected as needing a new submission becomes the
  // starting point of a new Draft, found under the Drafts tab.
  function startNewRequest(event: Event) {
    setStartingFrom(event.id);
    startTransition(async () => {
      try {
        const result = await startRequestFromRejected({ eventId: event.id });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(
          result.data.created
            ? "A new draft was started from this request."
            : "A new request was already started from this one. Find it in your events list.",
        );
        // As the Drafts tab button does, so a leftover status filter can't hide it.
        setActiveTab("DRAFT");
        setStatusFilter("ALL");
        setDraftToOpen(result.data.id);
        router.refresh();
      } finally {
        setStartingFrom(null);
      }
    });
  }

  // SCRUM-130 AC1: runs only after the confirmation dialog's Discard Draft.
  function discardDraft(event: Event) {
    startTransition(async () => {
      const result = await discardDraftEvent({ eventId: event.id });
      setDiscardingEvent(null);
      if (result.ok) {
        toast.success(`"${event.name}" was discarded.`);
      } else {
        toast.error(result.error);
      }
      router.refresh();
    });
  }

  const [searchQuery, setSearchQuery] = useState("");

  // A coordinator's second tab is their review queue; an organiser's is
  // everything they have sent. Both the filter and the count follow this.
  const submittedMeans = isCoordinator ? "awaiting-review" : "non-draft";

  const awaitingAnswer = new Set(awaitingAnswerIds);
  const clarified = new Set(clarifiedEventIds);
  const needsAction = (evt: Event) => needsOrganiserAction(evt, awaitingAnswer);
  const filteredEvents = filterAndSortEvents(events, {
    activeTab,
    statusFilter,
    searchQuery,
    sortField,
    sortOrder,
    submittedMeans,
    needsAction: (evt) => needsAction(evt as Event),
  });
  const actionCount = events.filter(needsAction).length;

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
    // Change 3: actions whose icon says it all are icon-only, named for
    // screen readers and with a tooltip.
    const iconButton = "h-10 w-full md:h-8 md:w-8 md:p-0";
    return (
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-nowrap md:items-center md:justify-end md:gap-1.5 [&>*:only-child]:col-span-2 md:[&>*:only-child]:col-span-1">
        {isDraft && (
          <Button
            variant="ghost"
            size="sm"
            className={iconButton}
            onClick={() => setEditingDraft(event)}
            data-testid="resume-draft-button"
            aria-label="Resume Draft"
            title="Resume Draft"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        {!isCoordinator && isRejected && !startsAgain && (
          <Button
            variant="outline"
            size="sm"
            className={cn(actionButton, "font-medium")}
            onClick={() => setEditingDraft(event)}
            data-testid="amend-rejected-button"
          >
            <Pencil className="h-3.5 w-3.5" />
            Amend & Resubmit
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
            {startingFrom === event.id ? "Starting…" : "Start New Request"}
          </Button>
        )}
        {/* SCRUM-208 AC1: the event opens on its own page. */}
        <Button
          asChild
          variant="ghost"
          size="sm"
          className={iconButton}
        >
          <Link
            href={`/events/${event.id}`}
            data-testid="view-details-button"
            aria-label="View Details"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </Link>
        </Button>
        {/* Shared page conventions: the thread is one click away. */}
        {!isCoordinator && clarified.has(event.id) && (
          <Button asChild variant="ghost" size="sm" className={iconButton}>
            <Link
              href={`/events/${event.id}?tab=clarification`}
              data-testid="clarifications-button"
              aria-label="Clarifications"
              title="Clarifications"
            >
              <MessagesSquare className="h-4 w-4" />
            </Link>
          </Button>
        )}
        {/* SCRUM-130 AC3: offered only on the Organiser's own Drafts. */}
        {!isCoordinator && isDraft && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              iconButton,
              "text-destructive hover:bg-destructive/10 hover:text-destructive",
            )}
            disabled={isPending}
            onClick={() => setDiscardingEvent(event)}
            data-testid="discard-draft-button"
            aria-label="Discard"
            title="Discard"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        {/* SCRUM-19: decide a request. SCRUM-135 AC3, AC4: only one Under
            Review, which has its Coordinator. There is no "claim": the Lead
            assigns a Submitted one (SCRUM-165). */}
        {isCoordinator &&
          (event.status === "SUBMITTED" || event.status === "UNDER_REVIEW") && (
            <>
              {/* Change 8: View, Ask, Approve, Reject; the decisions in
                  transparent green and red. */}
              <ReviewDecision event={event} buttonClassName={actionButton} />
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
              className={cn(
                "h-8 shrink-0 gap-1.5 text-xs font-medium",
                activeTab === "SUBMITTED" && "font-semibold",
              )}
              onClick={() => {
                setActiveTab("SUBMITTED");
                setStatusFilter("ALL");
              }}
            >
              {isCoordinator ? (
                <Inbox className="h-3.5 w-3.5" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {/* SCRUM-131 AC1: "Sent", since the tab lists every request
                  that isn't a draft, not only the Submitted ones. */}
              {isCoordinator ? "Awaiting review" : "Sent"} ({submittedCount})
            </Button>
            {!isCoordinator && (
              <Button
                variant={activeTab === "ACTION" ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 shrink-0 gap-1.5 text-xs font-medium",
                  activeTab === "ACTION" && "font-semibold",
                )}
                onClick={() => {
                  setActiveTab("ACTION");
                  setStatusFilter("ALL");
                }}
              >
                <BellRing className="h-3.5 w-3.5" />
                Actions required ({actionCount})
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full max-w-sm">
            <AppSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              aria-label="Filter by status"
              className="h-9 w-40 shrink-0 text-xs"
              options={[
                { value: "ALL", label: "All Statuses" },
                // SCRUM-233: no event stays Approved (SCRUM-81 AC1), so it
                // isn't offered; history entries still show its label.
                ...Object.entries(EVENT_STATUS_LABEL)
                  .filter(([value]) => value !== "APPROVED")
                  .map(([value, label]) => ({ value, label })),
              ]}
            />
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
                      aria-label="Sort by Last Updated"
                      className="flex items-center gap-1.5 font-semibold focus:outline-none focus:ring-1 focus:ring-ring rounded px-1 py-0.5 hover:bg-muted/50 transition-colors"
                    >
                      <span>Last Updated</span>
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
                        // Change 6: the name takes the room left and is cut
                        // short, so the other columns never wrap or shift.
                        className="font-medium md:w-full md:max-w-0"
                      >
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/events/${event.id}`}
                            title={event.name}
                            className="min-w-0 truncate text-left font-medium text-foreground hover:underline focus:outline-none"
                            data-testid="event-name-link"
                          >
                            {event.name}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell role="cell" data-col="status">
                        <div className="flex flex-wrap items-center gap-1">
                          <StatusBadge status={event.status} />
                          {/* SCRUM-82 AC10: started but still undecided. */}
                          {isCoordinator && isOverdue(event) && (
                            <span
                              data-testid="overdue-badge"
                              className="inline-flex items-center rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive"
                            >
                              Overdue
                            </span>
                          )}
                        </div>
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
                          Last Updated
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
        onSubmitted={setSubmittedId}
      />

      {/* Controlled Dialog Instance for Editing/Resuming Draft */}
      {draftInEditor && (
        <CreateEventDialog
          key={draftInEditor.id}
          open={!!draftInEditor}
          onOpenChange={(open) => {
            if (!open) {
              setEditingDraft(null);
              setDraftToOpen(null);
            }
          }}
          draftEvent={draftInEditor}
          onSubmitted={setSubmittedId}
        />
      )}

      {/* Change 8: the request went through; close, or see what was sent. */}
      <SubmittedDialog
        open={submittedId !== null}
        title="Request submitted"
        testId="event-request-submitted"
        closeLabel="Close"
        onClose={() => setSubmittedId(null)}
        action={{
          label: "View Details",
          onClick: () => {
            if (submittedId) router.push(`/events/${submittedId}`);
            setSubmittedId(null);
          },
        }}
      >
        Your event request has been sent for review. You&apos;ll be notified
        when a Coordinator decides on it.
      </SubmittedDialog>

      {/* SCRUM-130 AC1/AC2: nothing is discarded until this is confirmed. */}
      <Dialog
        open={!!discardingEvent}
        onOpenChange={(open) => !open && setDiscardingEvent(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Discard this draft?</DialogTitle>
            <DialogDescription>
              &ldquo;{discardingEvent?.name}&rdquo; will be removed from your
              events. A discarded draft can&rsquo;t be reopened.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDiscardingEvent(null)}
            >
              Keep Draft
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => discardingEvent && discardDraft(discardingEvent)}
            >
              {isPending ? "Discarding…" : "Discard Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
