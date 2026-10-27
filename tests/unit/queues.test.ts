import { describe, it, expect } from "vitest";

import { isOpenRequest } from "@/lib/equipment/requests";
import {
  arrangeQueue,
  nextWaiting,
  parseQueueView,
  queueHref,
  queueState,
  requestedLabel,
  sortChange,
  type QueueDefaults,
  type QueueItem,
} from "@/lib/queues";

// SCRUM-211 — the rules every work queue shares: the view in the link, the
// filter, search and sort, the Requested column, and the next item after a
// decision. Test cases: docs/testing/SCRUM-211.md.

const OLDEST_FIRST: QueueDefaults = { sort: "requested", dir: "asc" };
const SOONEST_FIRST: QueueDefaults = { sort: "event", dir: "asc" };

const day = (d: number) => new Date(Date.UTC(2031, 0, d, 2));
const item = (id: string, over: Partial<QueueItem> = {}): QueueItem => ({
  id,
  event: `Event ${id}`,
  eventStart: day(20),
  asked: "Needs a Coordinator",
  requestedAt: day(1),
  waiting: true,
  badges: [],
  ...over,
});

// Requested 1st, 2nd, 3rd; events on the 30th, 10th and 20th.
const A = item("a", { requestedAt: day(1), eventStart: day(30) });
const B = item("b", { requestedAt: day(2), eventStart: day(10) });
const C = item("c", { requestedAt: day(3), eventStart: day(20) });
const DONE = item("d", { requestedAt: day(4), eventStart: day(5), waiting: false });
const ITEMS = [A, B, C, DONE];

const ids = (items: QueueItem[]) => items.map((i) => i.id);

describe("SCRUM-211 — the queue's view, kept in the link (AC2)", () => {
  it("SCRUM-211 [AC1, AC2] TC-211-01: with nothing in the link, it is Waiting, unsearched, in the queue's own order", () => {
    expect(parseQueueView({}, OLDEST_FIRST)).toEqual({
      status: "waiting",
      q: "",
      sort: "requested",
      dir: "asc",
      open: null,
      done: false,
    });
    expect(parseQueueView({}, SOONEST_FIRST)).toMatchObject({ sort: "event", dir: "asc" });
  });

  it("SCRUM-211 [AC2] TC-211-03: the filter, search, sort and open item come from the link; anything wrong is ignored", () => {
    expect(
      parseQueueView(
        { status: "decided", q: "  Gala  ", sort: "event", dir: "desc", open: "x", done: "1" },
        OLDEST_FIRST,
      ),
    ).toEqual({ status: "decided", q: "Gala", sort: "event", dir: "desc", open: "x", done: true });
    expect(
      parseQueueView({ status: "nonsense", sort: "name", dir: "sideways" }, OLDEST_FIRST),
    ).toMatchObject({ status: "waiting", sort: "requested", dir: "asc" });
    // A sort with no direction reads ascending; repeated params take the first.
    expect(parseQueueView({ sort: ["event", "requested"] }, OLDEST_FIRST)).toMatchObject({
      sort: "event",
      dir: "asc",
    });
  });

  it("SCRUM-211 [AC2] TC-211-03: the link writes only what differs from the defaults, and drops 'done' on any change", () => {
    const view = parseQueueView({ done: "1" }, OLDEST_FIRST);
    expect(queueHref("/queue", view, OLDEST_FIRST)).toBe("/queue");
    expect(
      queueHref("/queue", view, OLDEST_FIRST, {
        status: "all",
        q: "Gala",
        sort: "event",
        dir: "desc",
        open: "x",
      }),
    ).toBe("/queue?status=all&q=Gala&sort=event&dir=desc&open=x");
    expect(queueHref("/queue", view, OLDEST_FIRST, { done: true })).toBe("/queue?done=1");
  });

  it("SCRUM-211 [AC1] TC-211-02: a column heading sorts by it, ascending first, then the other way", () => {
    const view = parseQueueView({}, OLDEST_FIRST);
    expect(sortChange(view, "event")).toEqual({ sort: "event", dir: "asc", open: null });
    expect(sortChange(view, "requested")).toEqual({ sort: "requested", dir: "desc", open: null });
    expect(sortChange({ ...view, dir: "desc" }, "requested")).toMatchObject({ dir: "asc" });
  });
});

describe("SCRUM-211 — filter, search and sort (AC1, AC2)", () => {
  const view = (params: Record<string, string>, defaults = OLDEST_FIRST) =>
    parseQueueView(params, defaults);

  it("SCRUM-211 [AC1] TC-211-01: by default, waiting items in the queue's own order: oldest request first, or soonest event first", () => {
    expect(ids(arrangeQueue(ITEMS, view({})))).toEqual(["a", "b", "c"]);
    expect(ids(arrangeQueue(ITEMS, view({}, SOONEST_FIRST)))).toEqual(["b", "c", "a"]);
  });

  it("SCRUM-211 [AC1] TC-211-02: sorted by event date or by requested, either way", () => {
    expect(ids(arrangeQueue(ITEMS, view({ sort: "event", dir: "asc" })))).toEqual(["b", "c", "a"]);
    expect(ids(arrangeQueue(ITEMS, view({ sort: "event", dir: "desc" })))).toEqual(["a", "c", "b"]);
    expect(ids(arrangeQueue(ITEMS, view({ sort: "requested", dir: "desc" })))).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("SCRUM-211 [AC1] TC-211-02: an item with no event date sorts last either way; ties keep the queue's order", () => {
    const undated = item("u", { eventStart: null, requestedAt: day(1) });
    const tie = item("t", { eventStart: day(10), requestedAt: day(9) });
    const items = [undated, A, B, tie];
    expect(ids(arrangeQueue(items, view({ sort: "event", dir: "asc" })))).toEqual([
      "b",
      "t",
      "a",
      "u",
    ]);
    expect(ids(arrangeQueue(items, view({ sort: "event", dir: "desc" })))).toEqual([
      "a",
      "b",
      "t",
      "u",
    ]);
    expect(ids(arrangeQueue([undated, item("v", { eventStart: null })], view({ sort: "event" })))).toEqual(["u", "v"]);
    // Wherever the undated item starts, it ends last.
    for (const order of [[A, undated, B], [A, B, undated], [undated, B, A]]) {
      expect(ids(arrangeQueue(order, view({ sort: "event", dir: "asc" })))).toEqual(["b", "a", "u"]);
    }
  });

  it("SCRUM-211 [AC2] TC-211-03: Waiting, Decided and All", () => {
    expect(ids(arrangeQueue(ITEMS, view({ status: "decided" })))).toEqual(["d"]);
    expect(ids(arrangeQueue(ITEMS, view({ status: "all" })))).toEqual(["a", "b", "c", "d"]);
  });

  it("SCRUM-211 [AC2] TC-211-04: the search matches the event's name, every word, ignoring case", () => {
    const items = [item("g", { event: "Spring Gala Dinner" }), item("f", { event: "Freshman Fair" })];
    expect(ids(arrangeQueue(items, view({ q: "gala" })))).toEqual(["g"]);
    expect(ids(arrangeQueue(items, view({ q: "dinner SPRING" })))).toEqual(["g"]);
    expect(ids(arrangeQueue(items, view({ q: "gala fair" })))).toEqual([]);
    // Only the event's name: what is asked isn't searched.
    expect(ids(arrangeQueue(items, view({ q: "Coordinator" })))).toEqual([]);
  });
});

describe("SCRUM-211 — the next item after a decision (AC4)", () => {
  it("SCRUM-211 [AC4] TC-211-07: the next waiting item in the view's order; from the last, the first still waiting", () => {
    const arranged = [A, B, DONE, C];
    expect(nextWaiting(arranged, "a")).toBe("b");
    expect(nextWaiting(arranged, "b")).toBe("c");
    expect(nextWaiting(arranged, "c")).toBe("a");
  });

  it("SCRUM-211 [AC4] TC-211-08: none when nothing else waits; an item no longer listed starts from the top", () => {
    expect(nextWaiting([A], "a")).toBeNull();
    expect(nextWaiting([A, DONE], "a")).toBeNull();
    expect(nextWaiting([A, B], "gone")).toBe("a");
  });

  it("SCRUM-211 [AC2, AC4] TC-211-07, TC-211-08: the page's links: the list, the next item, or the caught-up list", () => {
    const params = { q: "Event", open: "a" };
    const state = queueState("/queue", ITEMS, params, OLDEST_FIRST);
    expect(state.open).toBe(A);
    expect(state.waitingCount).toBe(3);
    expect(state.listHref).toBe("/queue?q=Event");
    expect(state.nextHref).toBe("/queue?q=Event&open=b");
    expect(state.href({ open: "c" })).toBe("/queue?q=Event&open=c");

    const last = queueState("/queue", [A, DONE], { open: "a" }, OLDEST_FIRST);
    expect(last.nextHref).toBe("/queue?done=1");
    expect(queueState("/queue", ITEMS, { open: "gone" }, OLDEST_FIRST).open).toBeNull();
    expect(queueState("/queue", ITEMS, {}, OLDEST_FIRST)).toMatchObject({
      open: null,
      nextHref: "/queue?done=1",
    });
  });
});

describe("SCRUM-211 — the Requested column (AC1)", () => {
  const now = new Date("2031-10-26T06:00:00Z"); // 26 Oct, 2 pm SGT

  it.each([
    ["2031-10-26T05:59:40Z", "Today (just now)"],
    ["2031-10-26T05:59:00Z", "Today (1 minute ago)"],
    ["2031-10-26T05:15:00Z", "Today (45 minutes ago)"],
    ["2031-10-26T04:00:00Z", "Today (2 hours ago)"],
    // Just after midnight in Singapore is still today.
    ["2031-10-25T16:30:00Z", "Today (13 hours ago)"],
    ["2031-10-25T15:30:00Z", "25 Oct (yesterday)"],
    ["2031-10-23T01:00:00Z", "23 Oct (3 days ago)"],
    ["2031-07-01T01:00:00Z", "1 Jul (3 months ago)"],
    ["2030-12-30T01:00:00Z", "30 Dec 2030 (9 months ago)"],
    ["2028-10-01T01:00:00Z", "1 Oct 2028 (3 years ago)"],
  ])("SCRUM-211 [AC1] TC-211-01: requested %s reads %s", (at, label) => {
    expect(requestedLabel(new Date(at), now)).toBe(label);
  });

  it("SCRUM-211 [AC1] TC-211-01: a time a little ahead of the clock still reads as just now", () => {
    expect(requestedLabel(new Date("2031-10-26T06:00:30Z"), now)).toBe("Today (just now)");
    expect(requestedLabel(new Date())).toBe("Today (just now)");
  });
});

describe("SCRUM-211 — Equipment Requests' waiting items", () => {
  it("SCRUM-211 [AC2] TC-211-03: a request waits while Pending Review or In Review, and is decided after", () => {
    expect(isOpenRequest({ status: "PENDING_REVIEW" })).toBe(true);
    expect(isOpenRequest({ status: "IN_REVIEW" })).toBe(true);
    expect(isOpenRequest({ status: "APPROVED" })).toBe(false);
    expect(isOpenRequest({ status: "REJECTED" })).toBe(false);
  });
});
