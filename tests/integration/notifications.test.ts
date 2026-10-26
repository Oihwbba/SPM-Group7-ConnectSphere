import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
  type Mock,
} from "vitest";
import type { Session } from "next-auth";
import { NotificationType } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  getMyNotifications,
  getMyUnreadCount,
} from "@/app/(app)/notifications/queries";
import { markNotificationRead } from "@/app/(app)/notifications/actions";

// SCRUM-48 against a real Postgres: which rows the list and the unread count
// return, and what opening one writes. Two throwaway users, so no seeded row
// is touched. Only the session is mocked.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
const mockAuth = auth as unknown as Mock;

const usesLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(
  process.env.DATABASE_URL ?? "",
);

const stamp = Date.now();
const ME = `usr_ntf_me_${stamp}`;
const OTHER = `usr_ntf_other_${stamp}`;
const signedInAs = (id: string): Session => ({
  user: { id, role: "ORGANISER", name: id, email: `${id}@test.local` },
  expires: "2999-01-01T00:00:00.000Z",
});
const minutes = (from: Date, n: number) =>
  new Date(from.getTime() + n * 60 * 1000);

describe.skipIf(!usesLocalDatabase)(
  "the notification list — real database (SCRUM-48)",
  () => {
    let eventId: string;

    const notify = (data: {
      userId?: string;
      title: string;
      type?: NotificationType;
      showFromAt?: Date;
      withdrawnAt?: Date;
      readAt?: Date;
    }) =>
      prisma.notification.create({
        data: {
          userId: ME,
          type: "EVENT_STATUS_CHANGED",
          message: `${data.title} message`,
          eventId,
          ...data,
        },
        select: { id: true },
      });

    beforeAll(async () => {
      await prisma.user.createMany({
        data: [ME, OTHER].map((id) => ({
          id,
          email: `${id}@test.local`,
          name: id,
          passwordHash: "x",
          role: "ORGANISER" as const,
        })),
      });
      eventId = (
        await prisma.event.create({
          data: { name: `SCRUM-48 ${stamp}`, organiserId: ME },
          select: { id: true },
        })
      ).id;
    });

    beforeEach(async () => {
      await prisma.notification.deleteMany({
        where: { userId: { in: [ME, OTHER] } },
      });
      mockAuth.mockResolvedValue(signedInAs(ME));
    });

    afterAll(async () => {
      await prisma.notification.deleteMany({
        where: { userId: { in: [ME, OTHER] } },
      });
      await prisma.event.deleteMany({ where: { id: eventId } });
      await prisma.user.deleteMany({ where: { id: { in: [ME, OTHER] } } });
    });

    it("SCRUM-48 [AC1] TC-48-01: all my notifications are listed, newest shown first", async () => {
      const now = new Date();
      await notify({ title: "Oldest", showFromAt: minutes(now, -30) });
      await notify({ title: "Newest", showFromAt: minutes(now, -1) });
      await notify({ title: "Middle", showFromAt: minutes(now, -10) });

      expect((await getMyNotifications(now)).map((n) => n.title)).toEqual([
        "Newest",
        "Middle",
        "Oldest",
      ]);
    });

    it("SCRUM-48 [AC1, AC8] TC-48-01: a reminder written early is ordered by when it shows, not when it was written", async () => {
      const now = new Date();
      await notify({ title: "Sent an hour ago", showFromAt: minutes(now, -60) });
      // Written now, shown from five minutes ago: the newest one to show.
      await prisma.notification.create({
        data: {
          userId: ME,
          type: "HOLD_EXPIRY_REMINDER",
          title: "Reminder",
          message: "24 hours left.",
          createdAt: minutes(now, -120),
          showFromAt: minutes(now, -5),
        },
      });

      expect((await getMyNotifications(now)).map((n) => n.title)).toEqual([
        "Reminder",
        "Sent an hour ago",
      ]);
    });

    it("SCRUM-48 [AC2, AC3] TC-48-02: opening an unread notification marks it read, and the unread count drops by one", async () => {
      const opened = await notify({ title: "Open me" });
      await notify({ title: "Leave me" });
      expect(await getMyUnreadCount()).toBe(2);

      expect(await markNotificationRead({ id: opened.id })).toEqual({
        ok: true,
        data: { id: opened.id },
      });

      const rows = await prisma.notification.findMany({
        where: { userId: ME },
        select: { title: true, readAt: true },
        orderBy: { title: "asc" },
      });
      expect(rows.map((r) => [r.title, r.readAt !== null])).toEqual([
        ["Leave me", false],
        ["Open me", true],
      ]);
      expect(await getMyUnreadCount()).toBe(1);
    });

    it("SCRUM-48 [AC2] TC-48-03: opening a read notification again keeps the time it was first read", async () => {
      const firstRead = new Date("2026-09-01T02:00:00.000Z");
      const opened = await notify({ title: "Read", readAt: firstRead });

      expect((await markNotificationRead({ id: opened.id })).ok).toBe(true);

      expect(
        await prisma.notification.findUniqueOrThrow({
          where: { id: opened.id },
          select: { readAt: true },
        }),
      ).toEqual({ readAt: firstRead });
    });

    it("SCRUM-48 [AC4] TC-48-05: with no notifications, the list is empty and the count is zero, not an error", async () => {
      await notify({ userId: OTHER, title: "Not mine" });

      expect(await getMyNotifications()).toEqual([]);
      expect(await getMyUnreadCount()).toBe(0);
    });

    it("SCRUM-48 [AC6] TC-48-09: another user's notifications are never listed or counted, and can't be marked read", async () => {
      await notify({ title: "Mine" });
      const theirs = await notify({ userId: OTHER, title: "Theirs" });

      expect((await getMyNotifications()).map((n) => n.title)).toEqual([
        "Mine",
      ]);
      expect(await getMyUnreadCount()).toBe(1);
      expect(await markNotificationRead({ id: theirs.id })).toEqual({
        ok: false,
        error: "Notification not found.",
      });
      expect(
        await prisma.notification.findUniqueOrThrow({
          where: { id: theirs.id },
          select: { readAt: true },
        }),
      ).toEqual({ readAt: null });
    });

    it("SCRUM-48 [AC7] TC-48-11: notifications of every type appear in the one list", async () => {
      const types = Object.values(NotificationType);
      for (const type of types) await notify({ title: type, type });

      expect((await getMyNotifications()).map((n) => n.title).sort()).toEqual(
        [...types].sort(),
      );
      expect(await getMyUnreadCount()).toBe(types.length);
    });

    it("SCRUM-48 [AC8] TC-48-12: shown from exactly now, it is listed and counted; from one millisecond later, it is neither", async () => {
      const now = new Date();
      await notify({ title: "Due now", showFromAt: now });
      await notify({
        title: "Due next",
        showFromAt: new Date(now.getTime() + 1),
      });

      expect((await getMyNotifications(now)).map((n) => n.title)).toEqual([
        "Due now",
      ]);
      expect(await getMyUnreadCount(now)).toBe(1);
    });

    it("SCRUM-48 [AC8] TC-48-13: a notification not yet showing can't be opened, and appears from its time on with nothing else done", async () => {
      const now = new Date();
      const reminder = await notify({
        title: "Reminder",
        showFromAt: minutes(now, 60),
      });

      expect(await getMyNotifications(now)).toEqual([]);
      expect(await getMyUnreadCount(now)).toBe(0);
      expect(await markNotificationRead({ id: reminder.id })).toEqual({
        ok: false,
        error: "Notification not found.",
      });

      const later = minutes(now, 60);
      expect((await getMyNotifications(later)).map((n) => n.title)).toEqual([
        "Reminder",
      ]);
      expect(await getMyUnreadCount(later)).toBe(1);
    });

    it("SCRUM-48 [AC8] TC-48-14: a notification withdrawn before its time never appears, even after that time", async () => {
      const now = new Date();
      const withdrawn = await notify({
        title: "Withdrawn",
        showFromAt: minutes(now, 60),
        withdrawnAt: now,
      });

      for (const at of [now, minutes(now, 60), minutes(now, 60 * 24)]) {
        expect(await getMyNotifications(at)).toEqual([]);
        expect(await getMyUnreadCount(at)).toBe(0);
      }
      expect(await markNotificationRead({ id: withdrawn.id })).toEqual({
        ok: false,
        error: "Notification not found.",
      });
    });

    it("SCRUM-48 [AC5] TC-48-06: an Organiser's notification about their event links to the event's page", async () => {
      await notify({ title: "About my event" });

      // SCRUM-208: the event's own page, not the old pop-up link.
      expect(await getMyNotifications()).toEqual([
        expect.objectContaining({
          title: "About my event",
          href: `/events/${eventId}`,
        }),
      ]);
    });
  },
);
