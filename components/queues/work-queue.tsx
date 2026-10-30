import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  Inbox,
  SearchX,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/datetime";
import {
  requestedLabel,
  sortChange,
  type QueueBadge,
  type QueueItem,
  type QueueSortKey,
  type QueueState,
} from "@/lib/queues";
import { cn } from "@/lib/utils";
import { QueueControls } from "./queue-controls";

const BADGE_VARIANT = {
  danger: "destructive",
  warning: "warning",
  info: "info",
} as const satisfies Record<QueueBadge["tone"], string>;

/**
 * SCRUM-211 — the one layout every work queue uses: its title, the same
 * filter and search (AC2), then either the list in four columns (AC1) or the
 * open item, its details on the left and the decision on the right (AC3). On
 * a phone the details come first, then the decision.
 */
export function WorkQueue({
  title,
  description,
  base,
  state,
  defaults,
  testId,
  noun = "requests",
  searchLabel,
  detail,
  decision,
  before,
  after,
}: {
  title: string;
  description: string;
  base: string;
  state: QueueState;
  defaults: { sort: QueueSortKey; dir: "asc" | "desc" };
  /** Names the open item's container for tests and links. */
  testId?: string;
  noun?: string;
  /** The search box's name, where the queue searches more than the event's. */
  searchLabel?: string;
  detail?: React.ReactNode;
  decision?: React.ReactNode;
  before?: React.ReactNode;
  after?: React.ReactNode;
}) {
  const { view, arranged, open } = state;
  const position = open
    ? arranged.findIndex((item) => item.id === open.id)
    : -1;

  return (
    <div className="space-y-6">
      {before}
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {title}
          <span
            data-testid="queue-count"
            aria-label={`${state.waitingCount} waiting`}
            className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-medium text-primary"
          >
            {state.waitingCount}
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <QueueControls
        base={base}
        view={view}
        defaults={defaults}
        searchLabel={searchLabel}
      />

      {view.open ? (
        <section aria-label="Open request" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href={state.listHref}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> All {noun}
            </Link>
            {position >= 0 && (
              <p
                className="text-xs text-muted-foreground"
                data-testid="queue-position"
              >
                {position + 1} of {arranged.length}
              </p>
            )}
          </div>
          {open ? (
            <div
              // A new item gets a fresh decision: no dialog or note carried
              // over from the one just decided (AC4).
              key={open.id}
              className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]"
              data-testid={testId}
              data-item={open.id}
            >
              <div className="min-w-0 space-y-4" data-testid="queue-details">
                <div className="space-y-1">
                  <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
                    <span data-testid="queue-item-name">{open.event}</span>
                    <Badges badges={open.badges} />
                  </h2>
                  <p className="text-sm text-muted-foreground">{open.asked}</p>
                </div>
                {detail}
              </div>
              <aside
                aria-label="Decision"
                data-testid="queue-decision"
                className="space-y-3 lg:sticky lg:top-20"
              >
                {decision}
              </aside>
            </div>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                This request isn&apos;t in the queue any more.
              </CardContent>
            </Card>
          )}
        </section>
      ) : arranged.length === 0 ? (
        <QueueEmpty state={state} noun={noun} />
      ) : (
        <QueueTable state={state} title={title} />
      )}

      {after}
    </div>
  );
}

/** AC1 — the four columns, the same in every queue; a row opens its item. */
function QueueTable({ state, title }: { state: QueueState; title: string }) {
  const { arranged } = state;
  return (
    <Card>
      <CardContent className="p-0">
        <Table aria-label={title} className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[34%]">Event</TableHead>
              <SortHead
                state={state}
                sortKey="event"
                label="Event date"
                className="w-[18%]"
              />
              <TableHead className="w-[28%]">What&apos;s asked</TableHead>
              <SortHead
                state={state}
                sortKey="requested"
                label="Requested"
                className="w-[20%]"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {arranged.map((item) => (
              <TableRow
                key={item.id}
                data-testid="queue-row"
                data-item={item.id}
                data-waiting={item.waiting}
                className="relative cursor-pointer"
              >
                <TableCell>
                  <span className="flex min-w-0 items-center gap-2">
                    <Link
                      href={state.href({ open: item.id })}
                      className="truncate font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                      title={item.event}
                    >
                      {item.event}
                    </Link>
                    <Badges badges={item.badges} />
                  </span>
                </TableCell>
                <TableCell
                  className="text-muted-foreground"
                  data-testid="event-date"
                >
                  {item.eventStart ? formatDate(item.eventStart) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <span
                    className="block truncate"
                    title={item.asked}
                    data-testid="asked"
                  >
                    {item.asked}
                  </span>
                </TableCell>
                <TableCell
                  className="text-muted-foreground"
                  data-testid="requested"
                >
                  {requestedLabel(item.requestedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** A column that sorts: says how it's sorted, and flips on a second click. */
function SortHead({
  state,
  sortKey,
  label,
  className,
}: {
  state: QueueState;
  sortKey: QueueSortKey;
  label: string;
  className?: string;
}) {
  const { view } = state;
  const active = view.sort === sortKey;
  const Icon = !active ? ArrowUpDown : view.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      className={className}
      aria-sort={
        active ? (view.dir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <Link
        href={state.href(sortChange(view, sortKey))}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </TableHead>
  );
}

function Badges({ badges }: { badges: QueueBadge[] }) {
  return badges.map((badge) => (
    <Badge
      key={badge.label}
      variant={BADGE_VARIANT[badge.tone]}
      className="shrink-0 whitespace-nowrap px-2 py-0 text-[11px]"
      data-testid="queue-badge"
    >
      {badge.label}
    </Badge>
  ));
}

/** AC2 — nothing waiting, nothing matching the search, or nothing decided. */
function QueueEmpty({ state, noun }: { state: QueueState; noun: string }) {
  const { view } = state;
  if (view.q && !view.done) {
    return (
      <Card data-testid="queue-empty" data-reason="search">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <SearchX className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="text-base font-medium">
            No {noun} match &lsquo;{view.q}&rsquo;
          </p>
          <Link
            href={state.href({ q: "", open: null })}
            className="text-sm font-medium text-primary hover:underline"
          >
            Clear search
          </Link>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card data-testid="queue-empty" data-reason={view.status}>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Inbox className="h-6 w-6" aria-hidden />
        </span>
        <p className="text-base font-medium">
          {view.status === "decided"
            ? `No decided ${noun} yet.`
            : "Nothing waiting. You're all caught up."}
        </p>
      </CardContent>
    </Card>
  );
}

/** A labelled fact in an item's details. */
export function QueueFact({
  label,
  children,
  testId,
}: {
  label: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div className="space-y-0.5" data-testid={testId}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/** The decision panel's card: a title, then the actions in the shared order. */
export function DecisionCard({
  title = "Decision",
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}

/** For a decided item: what was decided, by whom and when. */
export function DecidedNote({ children }: { children: React.ReactNode }) {
  return (
    <DecisionCard title="Decided">
      <p className="text-sm text-muted-foreground" data-testid="decided-note">
        {children}
      </p>
    </DecisionCard>
  );
}

export type { QueueItem };
