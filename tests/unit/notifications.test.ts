import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Session } from "next-auth";
import type { EventStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  notificationHref,
  visibleNotificationsWhere,
} from "@/lib/notifications";
import {
  getMyNotifications,
  getMyUnreadCount,
} from "@/app/(app)/notifications/queries";
import { markNotificationRead } from "@/app/(app)/notifications/actions";

// SCRUM-48 — the notification list, with the database mocked. `can()` runs
// for real, so each role's actual permission table decides its links. The
// same rules against real rows, including the show-from boundary, are in
// tests/integration/notifications.test.ts.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

const mockAuth = auth as unknown as Mock;
const db = prisma.notification as unknown as Record<string, Mock>;

const sessionFor = (role: Role, id = "usr_me"): Session => ({
  user: { id, role, name: "Test User", email: `${id}@test.local` },
  expires: "2999-01-01T00:00:00.000Z",
});
const user = (role: Role) => ({ id: "usr_me", role });
const NOW = new Date("2031-03-01T08:00:00.000Z");
const event = (status: EventStatus) => ({ id: "evt_1", status });

beforeEach(() => {
  vi.clearAllMocks();
  db.findMany.mockResolvedValue([]);
  db.count.mockResolvedValue(0);
  db.findFirst.mockResolvedValue(null);
  db.updateMany.mockResolvedValue({ count: 1 });
});

describe("visibleNotificationsWhere — SCRUM-48 AC6, AC8", () => {
  it("SCRUM-48 [AC6, AC8] TC-48-09: only my own, not withdrawn, and shown from their time on", () => {
    expect(visibleNotificationsWhere("usr_me", NOW)).toEqual({
      userId: "usr_me",
      withdrawnAt: null,
      showFromAt: { lte: NOW },
    });
  });
});

describe("notificationHref — SCRUM-48 AC5", () => {
  it.each(["ORGANISER", "COORDINATOR"] as const)(
    "SCRUM-48 [AC5] TC-48-06: a %s goes to their events list with the event open",
    (role) => {
      expect(
        notificationHref(user(role), {
          link: "/equipment-requests",
          event: event("PLANNING"),
        }),
      ).toBe("/events?event=evt_1");
    },
  );

  it("SCRUM-48 [AC5] TC-48-06: an Attendee goes to the Attendee page of a Confirmed event", () => {
    expect(
      notificationHref(user("ATTENDEE"), {
        link: null,
        event: event("CONFIRMED"),
      }),
    ).toBe("/events/evt_1");
  });

  const replanned = (registrations: { status: string }[]) => ({
    ...event("PLANNING"),
    confirmedStartAt: new Date("2031-06-01T01:00:00Z"),
    registrations,
  });

  it("SCRUM-85 [AC7, AC9] TC-85-08: an Attendee still registered for an event back in Planning is linked to its Attendee page, which shows what was last confirmed", () => {
    expect(
      notificationHref(user("ATTENDEE"), {
        link: null,
        event: replanned([{ status: "REGISTERED" }]),
      }),
    ).toBe("/events/evt_1");
  });

  it.each([
    ["withdrew", replanned([{ status: "WITHDRAWN" }])],
    ["never registered", replanned([])],
    ["sees an event never confirmed", { ...event("PLANNING"), confirmedStartAt: null, registrations: [{ status: "REGISTERED" }] }],
  ])(
    "SCRUM-85 [AC5, AC9] TC-85-08: an Attendee who %s gets no link to an event in Planning, which they can't open",
    (_, planningEvent) => {
      expect(
        notificationHref(user("ATTENDEE"), { link: null, event: planningEvent }),
      ).toBeNull();
    },
  );

  it.each(["CANCELLED", "COMPLETED"] as const)(
    "SCRUM-48 [AC5] TC-48-06: an Attendee gets no link for a %s event, which has no Attendee page",
    (status) => {
      expect(
        notificationHref(user("ATTENDEE"), {
          link: null,
          event: event(status),
        }),
      ).toBeNull();
    },
  );

  it.each([
    ["VENUE_STAFF", "/bookings"],
    ["TECH_SUPPORT", "/equipment-requests"],
  ] as const)(
    "SCRUM-48 [AC5] TC-48-06: %s, who can't open the event, follows the notification's own link",
    (role, link) => {
      expect(
        notificationHref(user(role), { link, event: event("PLANNING") }),
      ).toBe(link);
    },
  );

  it.each([
    "VENUE_STAFF",
    "TECH_SUPPORT",
    "COORDINATOR_LEAD",
    "SAFETY_OFFICER",
  ] as const)(
    "SCRUM-48 [AC5] TC-48-06: a %s with no page to open gets no link, never the event page",
    (role) => {
      expect(
        notificationHref(user(role), { link: null, event: event("PLANNING") }),
      ).toBeNull();
    },
  );

  it("SCRUM-48 [AC5] TC-48-06: a notification about no event keeps its own link", () => {
    expect(
      notificationHref(user("COORDINATOR"), {
        link: "/equipment-requests",
        event: null,
      }),
    ).toBe("/equipment-requests");
  });
});

describe("getMyNotifications — SCRUM-48", () => {
  it("SCRUM-48 [AC1, AC6, AC7, AC8] TC-48-01: reads the session user's visible notifications of every type, newest shown first", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER"));

    await getMyNotifications(NOW);

    const query = db.findMany.mock.calls[0][0];
    expect(query.where).toEqual({
      userId: "usr_me",
      withdrawnAt: null,
      showFromAt: { lte: NOW },
    });
    expect(query.orderBy).toEqual([
      { showFromAt: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ]);
  });

  it("SCRUM-48 [AC5] TC-48-06: each row carries the link for this user, not the stored one", async () => {
    mockAuth.mockResolvedValue(sessionFor("COORDINATOR"));
    db.findMany.mockResolvedValue([
      {
        id: "ntf_1",
        title: "Equipment request updated",
        message: "Approved.",
        link: "/equipment-requests",
        readAt: null,
        showFromAt: NOW,
        event: event("PLANNING"),
      },
    ]);

    expect(await getMyNotifications(NOW)).toEqual([
      {
        id: "ntf_1",
        title: "Equipment request updated",
        message: "Approved.",
        readAt: null,
        showFromAt: NOW,
        href: "/events?event=evt_1",
      },
    ]);
  });

  it("SCRUM-48 [AC6] TC-48-09: a signed-out caller gets an empty list, before the query runs", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await getMyNotifications()).toEqual([]);
    expect(db.findMany).not.toHaveBeenCalled();
  });

  it("SCRUM-48 [AC8] TC-48-12: without a time given, visibility is judged at the current time", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER"));
    const before = Date.now();

    await getMyNotifications();

    const shownBy = db.findMany.mock.calls[0][0].where.showFromAt.lte as Date;
    expect(shownBy.getTime()).toBeGreaterThanOrEqual(before);
    expect(shownBy.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe("getMyUnreadCount — SCRUM-48 AC3", () => {
  it("SCRUM-48 [AC3, AC8] TC-48-04: counts only my unread notifications that are showing", async () => {
    mockAuth.mockResolvedValue(sessionFor("VENUE_STAFF"));
    db.count.mockResolvedValue(3);

    expect(await getMyUnreadCount(NOW)).toBe(3);
    expect(db.count.mock.calls[0][0].where).toEqual({
      userId: "usr_me",
      withdrawnAt: null,
      showFromAt: { lte: NOW },
      readAt: null,
    });
  });

  it("SCRUM-48 [AC3] TC-48-04: a signed-out caller has no unread count, before the query runs", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await getMyUnreadCount()).toBe(0);
    expect(db.count).not.toHaveBeenCalled();
  });

  it("SCRUM-48 [AC3] TC-48-04: a failed count shows none in the header instead of failing every page", async () => {
    mockAuth.mockResolvedValue(sessionFor("ORGANISER"));
    db.count.mockRejectedValue(new Error("connection lost"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await getMyUnreadCount()).toBe(0);
    expect(logged).toHaveBeenCalledWith(
      "Couldn't count unread notifications",
      expect.any(Error),
    );
    logged.mockRestore();
  });
});

describe("markNotificationRead — SCRUM-48 AC2", () => {
  it("SCRUM-48 [AC2, AC3] TC-48-02: marks my unread notification read and refreshes the header's count", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE"));
    db.findFirst.mockResolvedValue({ id: "ntf_1" });

    expect(await markNotificationRead({ id: "ntf_1" })).toEqual({
      ok: true,
      data: { id: "ntf_1" },
    });

    expect(db.findFirst.mock.calls[0][0].where).toEqual(
      expect.objectContaining({
        id: "ntf_1",
        userId: "usr_me",
        withdrawnAt: null,
      }),
    );
    const update = db.updateMany.mock.calls[0][0];
    expect(update.where).toEqual(
      expect.objectContaining({ id: "ntf_1", userId: "usr_me", readAt: null }),
    );
    expect(update.data.readAt).toBeInstanceOf(Date);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("SCRUM-48 [AC6] TC-48-09: a notification that isn't mine or isn't showing is not found, and nothing is written", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE"));
    db.findFirst.mockResolvedValue(null);

    expect(await markNotificationRead({ id: "ntf_other" })).toEqual({
      ok: false,
      error: "Notification not found.",
    });
    expect(db.updateMany).not.toHaveBeenCalled();
  });

  it.each([{}, { id: "" }, { id: 7 }, null])(
    "SCRUM-48 [AC2] TC-48-15: invalid input %j is refused before any read or write",
    async (input) => {
      mockAuth.mockResolvedValue(sessionFor("ATTENDEE"));

      const result = await markNotificationRead(input);

      expect(result.ok).toBe(false);
      expect(db.findFirst).not.toHaveBeenCalled();
      expect(db.updateMany).not.toHaveBeenCalled();
    },
  );

  it("SCRUM-48 [AC6] TC-48-15: a signed-out caller is refused, and nothing is read or written", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await markNotificationRead({ id: "ntf_1" })).toEqual({
      ok: false,
      error: "You do not have permission to do that.",
    });
    expect(db.findFirst).not.toHaveBeenCalled();
    expect(db.updateMany).not.toHaveBeenCalled();
  });

  it("SCRUM-48 [AC2] TC-48-15: an unexpected database failure is not swallowed", async () => {
    mockAuth.mockResolvedValue(sessionFor("ATTENDEE"));
    db.findFirst.mockRejectedValue(new Error("connection lost"));

    await expect(markNotificationRead({ id: "ntf_1" })).rejects.toThrow(
      "connection lost",
    );
  });
});
