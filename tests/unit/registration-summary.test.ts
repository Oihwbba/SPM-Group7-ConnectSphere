import { describe, it, expect } from "vitest";

import {
  canWithdrawRegistration,
  registrationSummary,
} from "@/lib/registration-summary";

// SCRUM-212 AC1 — one badge and one line per event, as agreed with the PO
// (docs/testing/SCRUM-212.md, "The state mapping"). Expected wording is the
// agreed mapping's, not the code's output.
const NOW = new Date("2026-11-01T02:00:00Z");
const ms = (offset: number) => new Date(NOW.getTime() + offset);
const DAY = 24 * 60 * 60 * 1000;

const openEvent = {
  expectedAttendance: 20,
  registrationEnabled: true,
  registrationOpensAt: ms(-DAY),
  registrationClosesAt: ms(5 * DAY),
  startAt: ms(7 * DAY),
};

describe("SCRUM-212 AC1 — registration state at a glance", () => {
  it("SCRUM-212 [AC1] TC-212-01: my own registration comes first, however the event stands", () => {
    const expected = {
      state: "REGISTERED",
      badge: "You're registered",
      line: "You can withdraw until the event starts.",
    };
    // Open, full, and closed by hand: always "You're registered".
    expect(registrationSummary(openEvent, 8, true, NOW)).toEqual(expected);
    expect(registrationSummary(openEvent, 20, true, NOW)).toEqual(expected);
    expect(
      registrationSummary(
        { ...openEvent, registrationEnabled: false },
        8,
        true,
        NOW,
      ),
    ).toEqual(expected);
  });

  it("SCRUM-212 [AC1] TC-212-01: [Boundary] a registered Attendee is told they can withdraw until the start, and not at it", () => {
    expect(
      registrationSummary({ ...openEvent, startAt: ms(1) }, 8, true, NOW).line,
    ).toBe("You can withdraw until the event starts.");
    expect(
      registrationSummary({ ...openEvent, startAt: NOW }, 8, true, NOW).line,
    ).toBe("The event has started.");
  });

  it("SCRUM-212 [AC1] TC-212-02: an open event says Open and how many places are left", () => {
    expect(registrationSummary(openEvent, 8, false, NOW)).toEqual({
      state: "OPEN",
      badge: "Open",
      line: "12 places left",
    });
  });

  it("SCRUM-212 [AC1] TC-212-02: [Boundary] one place left is still Open, in the singular", () => {
    expect(registrationSummary(openEvent, 19, false, NOW)).toEqual({
      state: "OPEN",
      badge: "Open",
      line: "1 place left",
    });
  });

  it("SCRUM-212 [AC1] TC-212-03: [Boundary] with no places left the event is Full", () => {
    expect(registrationSummary(openEvent, 20, false, NOW)).toEqual({
      state: "FULL",
      badge: "Full",
      line: "No places left",
    });
  });

  it("SCRUM-212 [AC1] TC-212-04: before registration opens, the event says Not open yet and when it opens, in Singapore time", () => {
    expect(
      registrationSummary(
        // 3 Nov 2026, 9:00 am in Singapore (UTC+8).
        { ...openEvent, registrationOpensAt: new Date("2026-11-03T01:00:00Z") },
        0,
        false,
        NOW,
      ),
    ).toEqual({
      state: "NOT_YET_OPEN",
      badge: "Not open yet",
      line: "Opens 3 Nov 2026, 9:00 am SGT",
    });
  });

  it("SCRUM-212 [AC1] TC-212-04: [Boundary] registration is open from its opening instant, and not open 1 ms before", () => {
    expect(
      registrationSummary(
        { ...openEvent, registrationOpensAt: NOW },
        0,
        false,
        NOW,
      ).state,
    ).toBe("OPEN");
    expect(
      registrationSummary(
        { ...openEvent, registrationOpensAt: ms(1) },
        0,
        false,
        NOW,
      ).state,
    ).toBe("NOT_YET_OPEN");
  });

  it("SCRUM-212 [AC1] TC-212-05: registration closed by the Organiser reads Closed", () => {
    expect(
      registrationSummary(
        { ...openEvent, registrationEnabled: false },
        0,
        false,
        NOW,
      ),
    ).toEqual({
      state: "CLOSED",
      badge: "Closed",
      line: "Registration is closed",
    });
  });

  it("SCRUM-212 [AC1] TC-212-05: [Boundary] a passed closing time reads Closed from the closing instant, and Open 1 ms before", () => {
    expect(
      registrationSummary(
        { ...openEvent, registrationClosesAt: NOW },
        0,
        false,
        NOW,
      ),
    ).toEqual({
      state: "CLOSED",
      badge: "Closed",
      line: "Registration is closed",
    });
    expect(
      registrationSummary(
        { ...openEvent, registrationClosesAt: ms(1) },
        0,
        false,
        NOW,
      ).state,
    ).toBe("OPEN");
  });
});

describe("SCRUM-212 AC2 — Withdraw on My Registrations", () => {
  const future = { status: "CONFIRMED" as const, startAt: ms(DAY) };

  it("SCRUM-212 [AC2] TC-212-10: an active registration for an event still to start can be withdrawn, even while it is re-planned", () => {
    expect(canWithdrawRegistration("REGISTERED", future, NOW)).toBe(true);
    expect(
      canWithdrawRegistration(
        "REGISTERED",
        { ...future, status: "PLANNING" },
        NOW,
      ),
    ).toBe(true);
  });

  it("SCRUM-212 [AC2] TC-212-10: [Negative] a withdrawn or cancelled registration, or one for a cancelled event, can't be withdrawn", () => {
    expect(canWithdrawRegistration("WITHDRAWN", future, NOW)).toBe(false);
    expect(canWithdrawRegistration("CANCELLED", future, NOW)).toBe(false);
    expect(
      canWithdrawRegistration(
        "REGISTERED",
        { ...future, status: "CANCELLED" },
        NOW,
      ),
    ).toBe(false);
  });

  it("SCRUM-212 [AC2] TC-212-10: [Boundary] Withdraw is offered until the event's start, and not at it", () => {
    expect(
      canWithdrawRegistration("REGISTERED", { ...future, startAt: ms(1) }, NOW),
    ).toBe(true);
    expect(
      canWithdrawRegistration("REGISTERED", { ...future, startAt: NOW }, NOW),
    ).toBe(false);
  });
});
