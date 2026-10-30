import { formatDate, formatDayMonth, utcToSgWallTime } from "@/lib/datetime";

/**
 * SCRUM-211 — one layout for every work queue: the Unassigned Queue, Bookings,
 * Equipment Requests and Safety Checks. Each queue turns its own items into
 * the same four columns, and these rules filter, search, sort and step
 * through them the same way. The filter, search, sort and the open item live
 * in the link, so a refresh or a shared link keeps them (AC2).
 */

export type QueueStatus = "waiting" | "decided" | "all";
export type QueueSortKey = "event" | "requested";
export type QueueSortDir = "asc" | "desc";

/** What the link says the queue shows. */
export type QueueView = {
  status: QueueStatus;
  q: string;
  sort: QueueSortKey;
  dir: QueueSortDir;
  open: string | null;
  /** AC4: the last waiting item was just decided. */
  done: boolean;
};

/** A mark beside the event's name, e.g. Overdue (SCRUM-165). */
export type QueueBadge = { label: string; tone: "danger" | "warning" | "info" };

/** One item, as every queue lists it (AC1). */
export type QueueItem = {
  id: string;
  event: string;
  eventStart: Date | null;
  /** One short line: what the item asks for. */
  asked: string;
  requestedAt: Date;
  waiting: boolean;
  /**
   * Neither waiting nor decided, so shown only under All: e.g. a safety
   * check that went Outdated before anyone reviewed it.
   */
  onlyInAll?: boolean;
  badges: QueueBadge[];
};

/** A queue's own default order, kept from before (AC1). */
export type QueueDefaults = { sort: QueueSortKey; dir: QueueSortDir };

const STATUSES: QueueStatus[] = ["waiting", "decided", "all"];
const SORTS: QueueSortKey[] = ["event", "requested"];

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/** The view the link asks for; anything it doesn't say, or says wrongly, is the default. */
export function parseQueueView(
  params: Params,
  defaults: QueueDefaults,
): QueueView {
  const status = one(params.status) as QueueStatus;
  const sort = one(params.sort) as QueueSortKey;
  const dir = one(params.dir);
  const sorted = SORTS.includes(sort);
  return {
    status: STATUSES.includes(status) ? status : "waiting",
    q: (one(params.q) ?? "").trim(),
    sort: sorted ? sort : defaults.sort,
    dir:
      sorted && (dir === "asc" || dir === "desc")
        ? dir
        : sorted
          ? "asc"
          : defaults.dir,
    open: one(params.open) || null,
    done: one(params.done) === "1",
  };
}

/** The link for a view: only what differs from the defaults is written. */
export function queueHref(
  base: string,
  view: QueueView,
  defaults: QueueDefaults,
  change: Partial<QueueView> = {},
): string {
  // "Done" says only what the last decision led to; any other change clears it.
  const next = { ...view, done: false, ...change };
  const params = new URLSearchParams();
  if (next.status !== "waiting") params.set("status", next.status);
  if (next.q) params.set("q", next.q);
  if (next.sort !== defaults.sort || next.dir !== defaults.dir) {
    params.set("sort", next.sort);
    params.set("dir", next.dir);
  }
  if (next.open) params.set("open", next.open);
  if (next.done) params.set("done", "1");
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/** Sorting by a column: the other direction if it is already sorted by it. */
export function sortChange(
  view: QueueView,
  key: QueueSortKey,
): Partial<QueueView> {
  return {
    sort: key,
    dir: view.sort === key && view.dir === "asc" ? "desc" : "asc",
    open: null,
  };
}

const time = (date: Date | null) => date?.getTime() ?? Number.POSITIVE_INFINITY;

/**
 * The items the view shows, in its order: by status, by event name, then
 * sorted. Ties keep the queue's own order. An item without an event date
 * sorts last either way.
 */
export function arrangeQueue(items: QueueItem[], view: QueueView): QueueItem[] {
  const words = view.q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = items.filter(
    (item) =>
      (view.status === "all" ||
        (!item.onlyInAll && item.waiting === (view.status === "waiting"))) &&
      words.every((word) => item.event.toLowerCase().includes(word)),
  );
  const sign = view.dir === "asc" ? 1 : -1;
  const key = (item: QueueItem) =>
    view.sort === "event" ? time(item.eventStart) : item.requestedAt.getTime();
  return shown
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const [x, y] = [key(a.item), key(b.item)];
      if (x === y) return a.index - b.index;
      if (x === Number.POSITIVE_INFINITY) return 1;
      if (y === Number.POSITIVE_INFINITY) return -1;
      return (x - y) * sign;
    })
    .map(({ item }) => item);
}

/**
 * AC4 — the item to open after `current` is decided: the next waiting one in
 * the view's order, or, from the last, the first still waiting. Null when
 * nothing else waits.
 */
export function nextWaiting(
  arranged: QueueItem[],
  current: string,
): string | null {
  const at = arranged.findIndex((item) => item.id === current);
  const after = [
    ...arranged.slice(at + 1),
    ...arranged.slice(0, Math.max(at, 0)),
  ];
  return after.find((item) => item.waiting && item.id !== current)?.id ?? null;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** The Singapore calendar day of an instant, as a number of days. */
const sgDay = (date: Date) =>
  Math.floor(
    Date.parse(`${utcToSgWallTime(date).slice(0, 10)}T00:00:00Z`) / (24 * HOUR),
  );

const plural = (n: number, unit: string) =>
  `${n} ${unit}${n === 1 ? "" : "s"} ago`;

/**
 * The Requested column: the date and how long ago, e.g. "23 Oct (3 days ago)";
 * "Today (2 hours ago)" for today, and the year only when it isn't this one.
 */
export function requestedLabel(requestedAt: Date, now = new Date()): string {
  const days = sgDay(now) - sgDay(requestedAt);
  if (days <= 0) {
    const elapsed = Math.max(0, now.getTime() - requestedAt.getTime());
    const ago =
      elapsed < MINUTE
        ? "just now"
        : elapsed < HOUR
          ? plural(Math.floor(elapsed / MINUTE), "minute")
          : plural(Math.floor(elapsed / HOUR), "hour");
    return `Today (${ago})`;
  }
  const sameYear =
    utcToSgWallTime(requestedAt).slice(0, 4) ===
    utcToSgWallTime(now).slice(0, 4);
  const date = sameYear ? formatDayMonth(requestedAt) : formatDate(requestedAt);
  const ago =
    days === 1
      ? "yesterday"
      : days < 60
        ? plural(days, "day")
        : days < 730
          ? plural(Math.floor(days / 30.44), "month")
          : plural(Math.floor(days / 365), "year");
  return `${date} (${ago})`;
}

/** What a queue page needs from its items and its link, worked out once. */
export function queueState(
  base: string,
  items: QueueItem[],
  params: Params,
  defaults: QueueDefaults,
) {
  const view = parseQueueView(params, defaults);
  const arranged = arrangeQueue(items, view);
  const open = view.open
    ? (items.find((item) => item.id === view.open) ?? null)
    : null;
  const next = open ? nextWaiting(arranged, open.id) : null;
  return {
    view,
    arranged,
    open,
    waitingCount: items.filter((item) => item.waiting).length,
    /** The list, as filtered, searched and sorted, with nothing open. */
    listHref: queueHref(base, view, defaults, { open: null }),
    /** AC4: where a decision leads: the next waiting item, or the list. */
    nextHref: queueHref(base, view, defaults, {
      open: next,
      done: next === null,
    }),
    href: (change: Partial<QueueView>) =>
      queueHref(base, view, defaults, change),
  };
}

export type QueueState = ReturnType<typeof queueState>;
