import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { EventStatus, RegistrationStatus } from "@prisma/client";

import { RegistrationsList } from "@/app/(app)/registrations/registrations-list";
import {
  REPLANNING_LABEL,
  ReplanningEventDetail,
} from "@/app/(app)/events/replanning-event-detail";
import type { MyRegistration } from "@/app/(app)/registrations/queries";
import {
  shownEventTime,
  confirmedDetailsChanged,
  isBeingReplanned,
  venueLabel,
} from "@/lib/confirmed-details";

// SCRUM-85 AC8, AC9 — what a registered Attendee sees while their event is
// re-planned. Rendered to static markup; the journey runs in e2e.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(app)/events/registration-actions", () => ({
  withdrawRegistration: vi.fn(),
}));

const CONFIRMED_AT = new Date("2031-06-01T01:00:00Z");
const CONFIRMED_END = new Date("2031-06-01T05:00:00Z");
// Being re-planned: the live times have already moved.
const MOVED_AT = new Date("2031-07-09T01:00:00Z");

function registration(
  status: RegistrationStatus,
  eventStatus: EventStatus,
): MyRegistration {
  return {
    id: "reg1",
    status,
    event: {
      id: "evt1",
      name: "Charity Gala",
      status: eventStatus,
      startAt: MOVED_AT,
      endAt: MOVED_AT,
      cancellationReason: null,
      confirmedStartAt: CONFIRMED_AT,
      confirmedEndAt: CONFIRMED_END,
      confirmedVenues: ["Main Hall — Level 1", "Room 2 — Level 2"],
      bookings: [{ venue: { name: "New Hall", location: "Level 9" } }],
    },
  };
}

describe("My Registrations while an event is re-planned — SCRUM-85 AC8", () => {
  it("SCRUM-85 [AC8, AC10] TC-85-06: the card says details are being updated, never Planning, with what was last confirmed, and links to the event", () => {
    const html = renderToStaticMarkup(
      <RegistrationsList registrations={[registration("REGISTERED", "PLANNING")]} />,
    );

    expect(html).toContain(REPLANNING_LABEL);
    expect(html).not.toMatch(/Planning/);
    expect(html).toContain("Main Hall — Level 1; Room 2 — Level 2");
    expect(html).not.toContain("New Hall");
    expect(html).toContain('href="/events/evt1"');
  });

  it("SCRUM-85 [AC5] TC-85-06: a withdrawn registration reads Withdrawn, not paused", () => {
    const html = renderToStaticMarkup(
      <RegistrationsList registrations={[registration("WITHDRAWN", "PLANNING")]} />,
    );

    expect(html).not.toContain(REPLANNING_LABEL);
    expect(html).toContain("Withdrawn");
  });

  it("SCRUM-85 [AC11] TC-85-06: once Confirmed again, the card shows Registered and the live details, every venue", () => {
    const html = renderToStaticMarkup(
      <RegistrationsList registrations={[registration("REGISTERED", "CONFIRMED")]} />,
    );

    expect(html).not.toContain(REPLANNING_LABEL);
    expect(html).toContain("Registered");
    expect(html).toContain("New Hall — Level 9");
  });
});

describe("ReplanningEventDetail — SCRUM-85 AC9", () => {
  it("SCRUM-85 [AC9] TC-85-07: shows the name, description and the date, time and venues last confirmed, with no internal status", () => {
    const html = renderToStaticMarkup(
      <ReplanningEventDetail
        event={{
          name: "Charity Gala",
          description: "An evening for a good cause.",
          confirmedStartAt: CONFIRMED_AT,
          confirmedEndAt: CONFIRMED_END,
          confirmedVenues: ["Main Hall — Level 1", "Room 2 — Level 2"],
          startAt: MOVED_AT,
          registrations: [{ id: "reg1", status: "REGISTERED" }],
        }}
      />,
    );

    expect(html).toContain("Charity Gala");
    expect(html).toContain("An evening for a good cause.");
    expect(html).toContain(REPLANNING_LABEL);
    expect(html).toContain("Main Hall — Level 1");
    expect(html).toContain("Room 2 — Level 2");
    expect(html).toContain("1 Jun 2031");
    expect(html).not.toMatch(/Planning|Coordinator|Approved|Pending/);
    expect(html).toContain("You&#x27;re registered");
  });
});

describe("ReplanningEventDetail — withdrawing (SCRUM-85 AC9, SCRUM-77 AC3)", () => {
  const page = (startAt: Date | null) =>
    renderToStaticMarkup(
      <ReplanningEventDetail
        event={{
          name: "Charity Gala",
          description: null,
          confirmedStartAt: CONFIRMED_AT,
          confirmedEndAt: CONFIRMED_END,
          confirmedVenues: ["Main Hall — Level 1"],
          startAt,
          registrations: [{ id: "reg1", status: "REGISTERED" }],
        }}
      />,
    );

  it.each([
    ["has yet to start", new Date(Date.now() + 24 * 60 * 60 * 1000)],
    ["has no start set", null],
  ])(
    "SCRUM-85 [AC9] TC-85-07: Withdraw is offered while the event %s",
    (_, startAt) => {
      const html = page(startAt);
      expect(html).toContain('data-testid="withdraw-button"');
      expect(html).not.toContain('data-testid="withdraw-closed"');
    },
  );

  it("SCRUM-85 [AC9] TC-85-07, SCRUM-77 [AC3]: once the event has started, Withdraw isn't offered, as the server would refuse it", () => {
    const html = page(new Date(Date.now() - 60 * 1000));

    expect(html).not.toContain('data-testid="withdraw-button"');
    expect(html).toContain("The event has started, so you can no longer withdraw.");
  });
});

describe("confirmed details — SCRUM-85", () => {
  const before = {
    confirmedStartAt: CONFIRMED_AT,
    confirmedEndAt: CONFIRMED_END,
    confirmedVenues: ["Main Hall — Level 1"],
  };
  const same = {
    startAt: CONFIRMED_AT,
    endAt: CONFIRMED_END,
    venues: ["Main Hall — Level 1"],
  };

  it("SCRUM-85 [AC2] TC-85-02: a different start, end or venue list is a change; the same details are not", () => {
    expect(confirmedDetailsChanged(before, same)).toBe(false);
    expect(confirmedDetailsChanged(before, { ...same, startAt: MOVED_AT })).toBe(true);
    expect(confirmedDetailsChanged(before, { ...same, endAt: MOVED_AT })).toBe(true);
    expect(
      confirmedDetailsChanged(before, {
        ...same,
        venues: ["Main Hall — Level 1", "Room 2 — Level 2"],
      }),
    ).toBe(true);
  });

  it("SCRUM-85 [AC2] TC-85-04: nothing confirmed before is not a change", () => {
    expect(
      confirmedDetailsChanged(
        { confirmedStartAt: null, confirmedEndAt: null, confirmedVenues: [] },
        same,
      ),
    ).toBe(false);
  });

  it("SCRUM-85 [AC8] TC-85-06: only a Planning event that was Confirmed before is being re-planned", () => {
    expect(isBeingReplanned({ status: "PLANNING", confirmedStartAt: CONFIRMED_AT })).toBe(true);
    expect(isBeingReplanned({ status: "PLANNING", confirmedStartAt: null })).toBe(false);
    expect(isBeingReplanned({ status: "CONFIRMED", confirmedStartAt: CONFIRMED_AT })).toBe(false);
  });

  it("SCRUM-252 [AC2] TC-252-05: the row's date and the list's order agree: the last confirmed date while re-planned and still registered, the event's own otherwise", () => {
    const own = { startAt: new Date("2034-03-02T02:00:00Z"), endAt: new Date("2034-03-02T06:00:00Z") };
    const confirmed = { startAt: new Date("2034-03-01T02:00:00Z"), endAt: new Date("2034-03-01T06:00:00Z") };
    const event = { ...own, confirmedStartAt: confirmed.startAt, confirmedEndAt: confirmed.endAt };

    expect(shownEventTime("REGISTERED", { ...event, status: "PLANNING" })).toEqual(confirmed);
    expect(shownEventTime("WITHDRAWN", { ...event, status: "PLANNING" })).toEqual(own);
    expect(shownEventTime("REGISTERED", { ...event, status: "CONFIRMED" })).toEqual(own);
    expect(
      shownEventTime("REGISTERED", {
        ...own,
        status: "PLANNING",
        confirmedStartAt: null,
        confirmedEndAt: null,
      }),
    ).toEqual(own);
  });

  it("lists a venue as its name and location", () => {
    expect(venueLabel({ name: "Main Hall", location: "Level 1" })).toBe(
      "Main Hall — Level 1",
    );
  });
});
