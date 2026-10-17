import type { BookingStatus, Prisma } from "@prisma/client";

/**
 * SCRUM-163 — tentative holds. A Held booking reserves its venue only until
 * its expiry, whether or not anyone uses the app then (AC4). The row says
 * HELD until something writes it (the database marks lapsed holds Expired
 * before any booking write at that venue, ADR 0010), so every read decides
 * from the expiry, never from the stored status alone.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** A hold still reserving its venue at `now` (AC2). At the expiry it no longer does. */
export function liveHoldWhere(now: Date): Prisma.BookingWhereInput {
  return { status: "HELD", holdExpiresAt: { gt: now } };
}

/**
 * The bookings that reserve a venue at `now`: Approved ones and live holds
 * (AC2, SCRUM-159). Pending requests block nobody.
 */
export function reservingWhere(now: Date): Prisma.BookingWhereInput {
  return { OR: [{ status: "APPROVED" }, liveHoldWhere(now)] };
}

/**
 * The bookings that hold, or may still get, their venue at `now`: Pending,
 * Approved and live holds (SCRUM-26 AC2). A lapsed hold no longer counts,
 * even before anything has marked it Expired (AC4).
 */
export function liveBookingWhere(now: Date): Prisma.BookingWhereInput {
  return { OR: [{ status: { in: ["PENDING", "APPROVED"] } }, liveHoldWhere(now)] };
}

/** A booking's status as it stands at `now`: a lapsed hold is Expired (AC4). */
export function bookingStatusAt(
  booking: { status: BookingStatus; holdExpiresAt: Date | null },
  now: Date,
): BookingStatus {
  return booking.status === "HELD" &&
    booking.holdExpiresAt !== null &&
    booking.holdExpiresAt <= now
    ? "EXPIRED"
    : booking.status;
}

/**
 * AC5 — when the Coordinator's reminder shows: 24 hours before the expiry, or
 * straight away if less than that remains.
 */
export function holdReminderAt(expiresAt: Date, now: Date): Date {
  const dayBefore = new Date(expiresAt.getTime() - DAY_MS);
  return dayBefore > now ? dayBefore : now;
}

/**
 * AC5, SCRUM-48 AC8 — once a hold is confirmed, released or rejected, its
 * reminder and expiry notice that haven't shown yet never will. `about` picks
 * the holds: one booking, or every booking of an event (AC9).
 */
export function withdrawPendingHoldNotices(
  tx: Prisma.TransactionClient,
  about: { bookingId: string } | { eventId: string },
  now: Date,
) {
  return tx.notification.updateMany({
    where: {
      ...("bookingId" in about
        ? { bookingId: about.bookingId }
        : { eventId: about.eventId, bookingId: { not: null } }),
      withdrawnAt: null,
      showFromAt: { gt: now },
    },
    data: { withdrawnAt: now },
  });
}
