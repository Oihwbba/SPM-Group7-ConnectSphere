import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { EventStatus, RegistrationStatus } from "@prisma/client";

import { RegistrationsList } from "@/app/(app)/registrations/registrations-list";
import type { MyRegistration } from "@/app/(app)/registrations/queries";

// SCRUM-212 AC2 — My Registrations, rendered to static markup; the journey
// through the confirmation dialog runs in e2e.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(app)/events/registration-actions", () => ({
  withdrawRegistration: vi.fn(),
}));

const DAY = 24 * 60 * 60 * 1000;
// 7 Nov 2034, 9:00 am to 1:00 pm in Singapore.
const START = new Date("2034-11-07T01:00:00Z");
const END = new Date("2034-11-07T05:00:00Z");

function registration(
  status: RegistrationStatus,
  event: Partial<MyRegistration["event"]> & { status?: EventStatus } = {},
): MyRegistration {
  return {
    id: "reg1",
    status,
    event: {
      id: "evt1",
      name: "Charity Gala",
      status: "CONFIRMED",
      startAt: START,
      endAt: END,
      cancellationReason: null,
      confirmedStartAt: START,
      confirmedEndAt: END,
      confirmedVenues: ["Main Hall — Level 1"],
      bookings: [{ venue: { name: "Main Hall", location: "Level 1" } }],
      ...event,
    },
  };
}

const render = (...rows: MyRegistration[]) =>
  renderToStaticMarkup(<RegistrationsList registrations={rows} />);

const testId = (html: string, id: string) =>
  html.match(new RegExp(`data-testid="${id}"[^>]*>([\\s\\S]*?)</`))?.[1];

describe("SCRUM-212 AC2 — My Registrations", () => {
  it("SCRUM-212 [AC2] TC-212-08: a row shows the event, its date and time, its venue, my status and a link to the event", () => {
    const html = render(registration("REGISTERED"));

    expect(html).toContain(">Charity Gala</h2>");
    expect(testId(html, "event-date")).toMatch(
      /^7 Nov 2034, 9:00 am SGT – 1:00 pm SGT$/,
    );
    expect(testId(html, "venue")).toBe("Main Hall — Level 1");
    expect(html).toMatch(
      /data-testid="registration-status"[^>]*><svg[\s\S]*?<\/svg><span>Registered<\/span>/,
    );
    expect(html).toMatch(/<a[^>]*href="\/events\/evt1"[^>]*>View event<\/a>/);
  });

  it("SCRUM-212 [AC2] TC-212-08: with no approved venue, the venue reads Venue to be confirmed", () => {
    const html = render(registration("REGISTERED", { bookings: [] }));
    expect(testId(html, "venue")).toBe("Venue to be confirmed");
  });

  it.each([
    ["Withdrawn", "WITHDRAWN" as const],
    ["Cancelled", "CANCELLED" as const],
  ])("SCRUM-212 [AC2] TC-212-08: my status reads %s", (label, status) => {
    expect(render(registration(status))).toMatch(
      new RegExp(
        `data-testid="registration-status"[^>]*><svg[\\s\\S]*?</svg><span>${label}</span>`,
      ),
    );
  });

  it("SCRUM-212 [AC2] TC-212-10: Withdraw is offered for an active registration whose event is still to start", () => {
    const html = render(registration("REGISTERED"));
    expect(html).toMatch(/data-testid="withdraw-button"[^>]*>Withdraw</);
  });

  it.each([
    ["is Withdrawn", registration("WITHDRAWN")],
    [
      "is for a cancelled event",
      registration("REGISTERED", { status: "CANCELLED" }),
    ],
    [
      "is for an event that has started",
      registration("REGISTERED", { startAt: new Date(Date.now() - DAY) }),
    ],
  ])(
    "SCRUM-212 [AC2] TC-212-10: [Negative] Withdraw isn't offered when the registration %s",
    (_, row) => {
      expect(render(row)).not.toContain('data-testid="withdraw-button"');
    },
  );

  it("SCRUM-212 [AC2] TC-212-08: an event no longer open to Attendees has no link to it", () => {
    const html = render(registration("CANCELLED", { status: "CANCELLED" }));
    expect(html).not.toContain('href="/events/evt1"');
  });

  it("SCRUM-212 [AC2] TC-212-11: with no registrations, the list says so and links to Browse Events", () => {
    const html = render();
    expect(html).toContain("You haven&#x27;t registered for any events yet");
    expect(html).toMatch(/<a[^>]*href="\/events"[^>]*>Browse Events<\/a>/);
    expect(html).not.toContain('data-testid="registration-card"');
  });
});
