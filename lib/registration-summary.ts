import type { Event, EventStatus, RegistrationStatus } from "@prisma/client";

import { formatDateTime } from "@/lib/datetime";
import {
  canWithdrawNow,
  computeRegistrationState,
  remainingCapacity,
} from "@/lib/registration-state";

/** SCRUM-212 AC1 — the states an Attendee is shown, one per event. */
export type ShownRegistrationState =
  | "REGISTERED"
  | "OPEN"
  | "FULL"
  | "NOT_YET_OPEN"
  | "CLOSED";

export type RegistrationSummary = {
  state: ShownRegistrationState;
  badge: string;
  line: string;
};

type SummaryInput = Pick<
  Event,
  | "expectedAttendance"
  | "registrationEnabled"
  | "registrationOpensAt"
  | "registrationClosesAt"
  | "startAt"
>;

/**
 * SCRUM-212 AC1 — one badge and one short line saying where an event's
 * registration stands for this Attendee, the same on Browse Events and the
 * event page. Presentation only: the rules are computeRegistrationState's
 * (SCRUM-73, 74, 75), so what is shown never disagrees with what the server
 * allows. The Attendee's own registration comes first, because it is what
 * they most need to know.
 */
export function registrationSummary(
  event: SummaryInput,
  activeRegistrationCount: number,
  isRegistered: boolean,
  now: Date = new Date(),
): RegistrationSummary {
  if (isRegistered) {
    return {
      state: "REGISTERED",
      badge: "You're registered",
      line: canWithdrawNow(event, now)
        ? "You can withdraw until the event starts."
        : "The event has started.",
    };
  }

  const state = computeRegistrationState(event, activeRegistrationCount, now);
  switch (state) {
    case "OPEN": {
      const left = remainingCapacity(event, activeRegistrationCount);
      return {
        state,
        badge: "Open",
        line: `${left} ${left === 1 ? "place" : "places"} left`,
      };
    }
    case "FULL":
      return { state, badge: "Full", line: "No places left" };
    case "NOT_YET_OPEN":
      return {
        state,
        badge: "Not open yet",
        // NOT_YET_OPEN means an opening time is set and still ahead.
        line: `Opens ${formatDateTime(event.registrationOpensAt!)}`,
      };
    default:
      // A manual close and a passed closing time read the same to an
      // Attendee: they can't register (SCRUM-75 AC7).
      return {
        state: "CLOSED",
        badge: "Closed",
        line: "Registration is closed",
      };
  }
}

/**
 * SCRUM-212 AC2 — whether My Registrations offers Withdraw: the registration
 * is active, ConnectSphere hasn't cancelled the event (SCRUM-76 AC3 shows it
 * as Cancelled), and the event hasn't started (SCRUM-77 AC3, which the server
 * also enforces).
 */
export function canWithdrawRegistration(
  registrationStatus: RegistrationStatus,
  event: { status: EventStatus; startAt: Date | null },
  now: Date = new Date(),
): boolean {
  return (
    registrationStatus === "REGISTERED" &&
    event.status !== "CANCELLED" &&
    canWithdrawNow(event, now)
  );
}
