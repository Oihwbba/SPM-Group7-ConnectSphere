import { describe, it, expect } from "vitest";

import {
  computeRegistrationState,
  canWithdrawNow,
  effectiveClosesAt,
  registrationPeriodText,
  remainingCapacity,
  totalCapacity,
  canRegisterNow,
  canCloseRegistration,
  canReopenRegistration,
  REGISTRATION_STATE_LABEL,
  TAKES_REGISTRATION,
  takesRegistration,
} from "@/lib/registration-state";
import { formatDateTime } from "@/lib/datetime";
import { registrationNeededLabel } from "@/lib/schemas/event";

describe("SCRUM-171 AC3, AC4: which events take registrations", () => {
  it.each([
    [true, true],
    [null, true],
    [false, false],
  ])(
    "SCRUM-171 [AC4] TC-171-06: Registration needed %s → takes registrations: %s",
    (registrationRequired, takes) => {
      expect(takesRegistration({ registrationRequired })).toBe(takes);
    },
  );

  it("SCRUM-171 [AC4] TC-171-06: the query asks for Yes or unanswered, since SQL never matches NULL with <> false", () => {
    expect(TAKES_REGISTRATION).toEqual({
      OR: [{ registrationRequired: true }, { registrationRequired: null }],
    });
  });

  it.each([
    [true, "Yes"],
    [false, "No"],
    [null, "Not answered"],
  ])(
    "SCRUM-171 [AC3] TC-171-04: Registration needed %s reads as %s",
    (registrationRequired, label) => {
      expect(registrationNeededLabel(registrationRequired)).toBe(label);
    },
  );
});

// SCRUM-72/73/74 — this is the ONE place the registration-state rule is
// defined, so it gets its own dedicated, pure (no mocking) test file. The
// browse list, the detail page and the register action all call the same
// function; these tests are what makes that safe.

function baseEvent(
  over: Partial<{
    expectedAttendance: number | null;
    registrationEnabled: boolean;
    registrationOpensAt: Date | null;
    registrationClosesAt: Date | null;
    startAt: Date | null;
  }> = {},
) {
  return {
    expectedAttendance: 100,
    registrationEnabled: true,
    registrationOpensAt: null,
    registrationClosesAt: null,
    startAt: null,
    ...over,
  };
}

describe("totalCapacity — SCRUM-73/74: expected attendance IS the capacity", () => {
  it("returns expectedAttendance directly", () => {
    expect(totalCapacity(baseEvent({ expectedAttendance: 50 }))).toBe(50);
  });

  it("treats a null expectedAttendance as zero capacity rather than throwing", () => {
    expect(totalCapacity(baseEvent({ expectedAttendance: null }))).toBe(0);
  });
});

describe("remainingCapacity", () => {
  it("AC: subtracts active registrations from the total", () => {
    expect(remainingCapacity(baseEvent({ expectedAttendance: 100 }), 40)).toBe(
      60,
    );
  });

  it("Boundary: exactly at capacity returns zero, not negative", () => {
    expect(remainingCapacity(baseEvent({ expectedAttendance: 10 }), 10)).toBe(
      0,
    );
  });

  it("Boundary: over capacity (a pre-existing data anomaly) still floors at zero", () => {
    expect(remainingCapacity(baseEvent({ expectedAttendance: 10 }), 15)).toBe(
      0,
    );
  });

  it("Boundary: zero registrations against zero capacity is zero remaining, not negative", () => {
    expect(remainingCapacity(baseEvent({ expectedAttendance: 0 }), 0)).toBe(0);
  });
});

describe("computeRegistrationState — precedence and each state", () => {
  const now = new Date("2031-06-01T12:00:00Z");

  it("[Positive] AC: open, unfilled, no period configured → OPEN", () => {
    expect(computeRegistrationState(baseEvent(), 0, now)).toBe("OPEN");
  });

  it("[Negative] AC: registrationEnabled false → CLOSED, regardless of capacity or period", () => {
    expect(
      computeRegistrationState(
        baseEvent({ registrationEnabled: false }),
        0,
        now,
      ),
    ).toBe("CLOSED");
  });

  it("[Negative] AC: registrationClosesAt in the past → EXPIRED", () => {
    expect(
      computeRegistrationState(
        baseEvent({ registrationClosesAt: new Date("2031-05-01T00:00:00Z") }),
        0,
        now,
      ),
    ).toBe("EXPIRED");
  });

  it("[Boundary] SCRUM-75 AC7: registrationClosesAt exactly now counts as already closed (<=, not <)", () => {
    expect(
      computeRegistrationState(
        baseEvent({ registrationClosesAt: now }),
        0,
        now,
      ),
    ).toBe("EXPIRED");
  });

  it("[Negative] AC: registrationOpensAt in the future → NOT_YET_OPEN", () => {
    expect(
      computeRegistrationState(
        baseEvent({ registrationOpensAt: new Date("2031-07-01T00:00:00Z") }),
        0,
        now,
      ),
    ).toBe("NOT_YET_OPEN");
  });

  it("[Boundary] registrationOpensAt exactly now already counts as open (not NOT_YET_OPEN)", () => {
    expect(
      computeRegistrationState(baseEvent({ registrationOpensAt: now }), 0, now),
    ).toBe("OPEN");
  });

  it("[Negative] AC: remaining capacity zero → FULL", () => {
    expect(
      computeRegistrationState(baseEvent({ expectedAttendance: 5 }), 5, now),
    ).toBe("FULL");
  });

  it("[Boundary] AC: one remaining place → OPEN, not FULL", () => {
    expect(
      computeRegistrationState(baseEvent({ expectedAttendance: 5 }), 4, now),
    ).toBe("OPEN");
  });

  it("Precedence: a manual close wins over an otherwise-full event", () => {
    expect(
      computeRegistrationState(
        baseEvent({ registrationEnabled: false, expectedAttendance: 5 }),
        5,
        now,
      ),
    ).toBe("CLOSED");
  });

  it("Precedence: not-yet-open wins over full (nobody could have filled it yet)", () => {
    expect(
      computeRegistrationState(
        baseEvent({
          registrationOpensAt: new Date("2031-07-01T00:00:00Z"),
          expectedAttendance: 5,
        }),
        5,
        now,
      ),
    ).toBe("NOT_YET_OPEN");
  });
});

describe("canRegisterNow", () => {
  it("is true only for OPEN", () => {
    expect(canRegisterNow("OPEN")).toBe(true);
    expect(canRegisterNow("FULL")).toBe(false);
    expect(canRegisterNow("NOT_YET_OPEN")).toBe(false);
    expect(canRegisterNow("CLOSED")).toBe(false);
    expect(canRegisterNow("EXPIRED")).toBe(false);
  });
});

describe("SCRUM-75 AC6, AC8: which registration can be closed or reopened", () => {
  const startAt = new Date("2031-06-10T01:00:00Z");

  it.each([
    ["OPEN", true],
    ["FULL", true],
    ["NOT_YET_OPEN", false],
    ["CLOSED", false],
    ["EXPIRED", false],
  ] as const)(
    "SCRUM-75 [AC6] TC-75-09: registration that is %s can be closed: %s",
    (state, closable) => {
      expect(canCloseRegistration(state)).toBe(closable);
    },
  );

  it.each([
    ["CLOSED", true],
    ["EXPIRED", true],
    ["OPEN", false],
    ["FULL", false],
    ["NOT_YET_OPEN", false],
  ] as const)(
    "SCRUM-75 [AC6] TC-75-10: before the start, registration that is %s can be reopened: %s",
    (state, reopenable) => {
      const now = new Date(startAt.getTime() - 1);
      expect(canReopenRegistration({ startAt }, state, now)).toBe(reopenable);
    },
  );

  it("SCRUM-75 [AC8] TC-75-10: at the exact start instant, nothing can be reopened", () => {
    expect(canReopenRegistration({ startAt }, "EXPIRED", startAt)).toBe(false);
    expect(canReopenRegistration({ startAt }, "CLOSED", startAt)).toBe(false);
  });

  it("SCRUM-75 [AC8] TC-75-10: an event with no start can't be reopened", () => {
    expect(
      canReopenRegistration({ startAt: null }, "CLOSED", new Date()),
    ).toBe(false);
  });
});

describe("REGISTRATION_STATE_LABEL", () => {
  it("has a human label for every state (exhaustive at the type level too)", () => {
    const states: Array<keyof typeof REGISTRATION_STATE_LABEL> = [
      "OPEN",
      "FULL",
      "NOT_YET_OPEN",
      "CLOSED",
      "EXPIRED",
    ];
    for (const s of states) {
      expect(REGISTRATION_STATE_LABEL[s]).toBeTruthy();
    }
  });
});

describe("SCRUM-129 [AC5 - One period convention]: the registration window includes its opening instant and excludes its closing one", () => {
  const opensAt = new Date("2031-06-01T01:00:00Z");
  const closesAt = new Date("2031-06-08T01:00:00Z");
  const windowEvent = baseEvent({
    registrationOpensAt: opensAt,
    registrationClosesAt: closesAt,
  });

  it("SCRUM-129 [AC5 - One period convention]: registration is open at the exact opening instant", () => {
    expect(computeRegistrationState(windowEvent, 0, opensAt)).toBe("OPEN");
  });

  it("SCRUM-129 [AC5 - One period convention]: registration is no longer open at the exact closing instant", () => {
    expect(computeRegistrationState(windowEvent, 0, closesAt)).toBe("EXPIRED");
  });
});

describe("SCRUM-72 AC5 / SCRUM-75 AC4, AC8: registration closes at the event's start", () => {
  const startAt = new Date("2031-06-10T01:00:00Z");
  const before = new Date("2031-06-09T01:00:00Z");
  const after = new Date("2031-06-10T02:00:00Z");

  it("SCRUM-72 AC5: no period set, before the event starts → OPEN", () => {
    expect(computeRegistrationState(baseEvent({ startAt }), 0, before)).toBe(
      "OPEN",
    );
  });

  it("SCRUM-72 AC5: no period set, at the exact start instant → closed", () => {
    expect(computeRegistrationState(baseEvent({ startAt }), 0, startAt)).toBe(
      "EXPIRED",
    );
  });

  it("SCRUM-72 AC5: no period set, after the event starts → closed", () => {
    expect(computeRegistrationState(baseEvent({ startAt }), 0, after)).toBe(
      "EXPIRED",
    );
  });

  it("SCRUM-75 AC8: a closing time later than the start is ignored once the event has started", () => {
    const stale = baseEvent({
      startAt,
      registrationClosesAt: new Date("2031-06-12T01:00:00Z"),
    });
    expect(computeRegistrationState(stale, 0, after)).toBe("EXPIRED");
  });

  it("SCRUM-75 AC8: an event that has started is closed even when it is also full", () => {
    expect(
      computeRegistrationState(
        baseEvent({ startAt, expectedAttendance: 5 }),
        5,
        after,
      ),
    ).toBe("EXPIRED");
  });
});

describe("effectiveClosesAt — the earlier of the closing time and the event start", () => {
  const startAt = new Date("2031-06-10T01:00:00Z");
  const earlier = new Date("2031-06-08T01:00:00Z");
  const later = new Date("2031-06-12T01:00:00Z");

  it("is the event start when no closing time is set", () => {
    expect(effectiveClosesAt({ registrationClosesAt: null, startAt })).toBe(
      startAt,
    );
  });

  it("is the closing time when it comes before the start", () => {
    expect(effectiveClosesAt({ registrationClosesAt: earlier, startAt })).toBe(
      earlier,
    );
  });

  it("is the start when the closing time comes after it", () => {
    expect(effectiveClosesAt({ registrationClosesAt: later, startAt })).toBe(
      startAt,
    );
  });

  it("is the closing time when no start is set", () => {
    expect(
      effectiveClosesAt({ registrationClosesAt: earlier, startAt: null }),
    ).toBe(earlier);
  });

  it("is null when neither is set", () => {
    expect(
      effectiveClosesAt({ registrationClosesAt: null, startAt: null }),
    ).toBeNull();
  });
});

describe("SCRUM-72 AC3: registrationPeriodText — the period an Attendee sees", () => {
  const startAt = new Date("2031-06-10T01:00:00Z");
  const opensAt = new Date("2031-06-01T01:00:00Z");
  const closesAt = new Date("2031-06-08T01:00:00Z");

  it("SCRUM-72 AC3: a set window shows its opening and closing times", () => {
    expect(
      registrationPeriodText({
        registrationOpensAt: opensAt,
        registrationClosesAt: closesAt,
        startAt,
      }),
    ).toBe(
      `Opens ${formatDateTime(opensAt)} · Closes ${formatDateTime(closesAt)}`,
    );
  });

  it("SCRUM-72 AC5: no window set shows the default — opens on confirmation, closes at the start", () => {
    expect(
      registrationPeriodText({
        registrationOpensAt: null,
        registrationClosesAt: null,
        startAt,
      }),
    ).toBe(`Opens on confirmation · Closes ${formatDateTime(startAt)}`);
  });

  it("SCRUM-75 AC8: a closing time after the start shows the start as the close", () => {
    expect(
      registrationPeriodText({
        registrationOpensAt: opensAt,
        registrationClosesAt: new Date("2031-06-12T01:00:00Z"),
        startAt,
      }),
    ).toBe(
      `Opens ${formatDateTime(opensAt)} · Closes ${formatDateTime(startAt)}`,
    );
  });

  it("omits the close when neither a closing time nor a start is set", () => {
    expect(
      registrationPeriodText({
        registrationOpensAt: null,
        registrationClosesAt: null,
        startAt: null,
      }),
    ).toBe("Opens on confirmation");
  });
});

describe("canWithdrawNow — SCRUM-77 AC3: up to, but not including, the event's start", () => {
  const startAt = new Date("2031-06-10T01:00:00Z");

  it("SCRUM-77 [AC3] TC-77-03: [Positive] before the start, withdrawal is allowed", () => {
    expect(canWithdrawNow({ startAt }, new Date("2031-06-10T00:59:59Z"))).toBe(
      true,
    );
  });

  it("SCRUM-77 [AC3] TC-77-04: [Boundary] at the exact start instant, withdrawal is refused", () => {
    expect(canWithdrawNow({ startAt }, startAt)).toBe(false);
  });

  it("SCRUM-77 [AC3] TC-77-05: [Negative] after the start, withdrawal is refused", () => {
    expect(canWithdrawNow({ startAt }, new Date("2031-06-10T02:00:00Z"))).toBe(
      false,
    );
  });

  it("SCRUM-77 [AC3] TC-77-03: [Boundary] an event with no start set can still be withdrawn from", () => {
    expect(canWithdrawNow({ startAt: null })).toBe(true);
  });
});
