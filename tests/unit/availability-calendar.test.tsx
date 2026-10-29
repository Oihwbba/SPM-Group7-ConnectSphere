import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { AvailabilityCalendar } from "@/app/(app)/venues/availability/availability-calendar";
import { availabilityByDay, closedHours } from "@/lib/venue-availability";
import { formatDateTime } from "@/lib/datetime";
import type { OpeningDay } from "@/lib/venue-hours";

// SCRUM-36 — what the week grid says about a day. Rendering only.

// The grid opens scrolled in the browser; here where it opens is markup.
vi.mock("@/app/(app)/venues/availability/week-scroll", () => ({
  WeekScroll: ({ top, children }: { top: number; children: React.ReactNode }) => (
    <div data-scroll-top={top}>{children}</div>
  ),
}));

const sg = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+08:00`);

/** The part of the week grid's markup for one day's column. */
function column(html: string, day: string): string {
  const grid = html.slice(html.indexOf('data-view="week"'));
  const start = grid.indexOf(`data-day="${day}"`);
  const end = grid.indexOf("data-day=", start + 1);
  return grid.slice(start, end === -1 ? undefined : end);
}

function render(days: ReturnType<typeof availabilityByDay>) {
  return renderToStaticMarkup(
    <AvailabilityCalendar
      venueName="Seminar Room"
      days={days}
      today="2035-03-01"
    />,
  );
}

describe("AvailabilityCalendar — SCRUM-36", () => {
  it("SCRUM-36 [AC6] TC-36-04: a day with nothing on it says Available all day at the top of its column", () => {
    const html = render(availabilityByDay([], "2035-03-12", "2035-03-18"));

    expect(html.match(/data-free-all-day/g)).toHaveLength(7);
  });

  it("SCRUM-36 [AC3] TC-36-02: a day filled by recorded unavailability is not called available", () => {
    const html = render(
      availabilityByDay(
        [
          {
            kind: "unavailability",
            id: "vun_1",
            // Mon 12 to Wed 14 Mar: Tuesday is unavailable from midnight to midnight.
            startAt: sg("2035-03-12", "18:00"),
            endAt: sg("2035-03-14", "09:00"),
            reason: "SAFETY_CONCERN",
          },
        ],
        "2035-03-12",
        "2035-03-18",
      ),
    );

    expect(column(html, "2035-03-13")).not.toContain("data-free-all-day");
    expect(column(html, "2035-03-13")).toContain(
      "Unavailable (safety concern) all day",
    );
    // The untouched days still say so.
    expect(column(html, "2035-03-15")).toContain("data-free-all-day");
  });

  it("SCRUM-163 [AC2] TC-163-04: a held booking reads as held until its expiry, in its words and its details, and an approved one as booked", () => {
    const heldUntil = sg("2035-03-10", "18:00");
    const details = (id: string, until: Date | null) => ({
      kind: "booking" as const,
      id,
      heldUntil: until,
      details: {
        kind: "booking" as const,
        startAt: sg("2035-03-13", "09:00"),
        endAt: sg("2035-03-13", "12:00"),
        heldUntil: until,
        eventName: "Symposium",
        requestedBy: "Cody Coordinator",
        attendance: 40,
        layout: null,
        setupMinutes: 0,
        turnaroundMinutes: 0,
      },
    });
    const html = render(
      availabilityByDay(
        [
          {
            ...details("bkg_held", heldUntil),
            startAt: sg("2035-03-13", "09:00"),
            endAt: sg("2035-03-13", "12:00"),
          },
          {
            ...details("bkg_ok", null),
            startAt: sg("2035-03-14", "09:00"),
            endAt: sg("2035-03-14", "12:00"),
          },
        ],
        "2035-03-12",
        "2035-03-18",
      ),
    );

    const held = column(html, "2035-03-13");
    // Its summary for screen readers, and the hover details' status line.
    expect(
      held.split(`Held until ${formatDateTime(heldUntil)}`).length - 1,
    ).toBeGreaterThanOrEqual(2);
    expect(held).not.toContain(">Booked<");
    expect(column(html, "2035-03-14")).toContain(">Booked<");
    expect(column(html, "2035-03-14")).not.toContain("Held until");
  });

  it("SCRUM-159 [AC7] TC-159-10: a booking's setup and turnaround show around it, in words and marked as their own kinds", () => {
    const html = render(
      availabilityByDay(
        [
          {
            kind: "setup",
            id: "bkg_1-setup",
            startAt: sg("2035-03-13", "09:30"),
            endAt: sg("2035-03-13", "10:00"),
            eventName: "Research Symposium",
          },
          {
            kind: "booking",
            id: "bkg_1",
            startAt: sg("2035-03-13", "10:00"),
            endAt: sg("2035-03-13", "12:00"),
          },
          {
            kind: "turnaround",
            id: "bkg_1-turnaround",
            startAt: sg("2035-03-13", "12:00"),
            endAt: sg("2035-03-13", "12:45"),
            eventName: "Research Symposium",
          },
        ],
        "2035-03-12",
        "2035-03-18",
      ),
    );
    const tuesday = column(html, "2035-03-13");

    expect(tuesday).toContain('data-kind="setup"');
    expect(tuesday).toContain('data-kind="turnaround"');
    expect(tuesday).toContain(
      "Setup for Research Symposium 9:30 am SGT to 10:00 am SGT",
    );
    expect(tuesday).toContain(
      "Turnaround for Research Symposium 12:00 pm SGT to 12:45 pm SGT",
    );
    // The legend explains the new kinds.
    expect(html).toMatch(/Legend[\s\S]*Setup[\s\S]*Turnaround/);
  });

  it("SCRUM-159 [AC7] TC-159-10: a booking's hover card says when its setup and turnaround hold the venue, and a booking without them says nothing extra", () => {
    const booking = (
      id: string,
      from: string,
      to: string,
      setupMinutes: number,
      turnaroundMinutes: number,
    ) => ({
      kind: "booking" as const,
      id,
      startAt: sg("2035-03-13", from),
      endAt: sg("2035-03-13", to),
      details: {
        kind: "booking" as const,
        startAt: sg("2035-03-13", from),
        endAt: sg("2035-03-13", to),
        heldUntil: null,
        eventName: `Event ${id}`,
        requestedBy: "Cody Coordinator",
        attendance: 50,
        layout: null,
        setupMinutes,
        turnaroundMinutes,
      },
    });
    const html = render(
      availabilityByDay(
        [booking("bkg_1", "10:00", "12:00", 30, 45), booking("bkg_2", "15:00", "16:00", 0, 0)],
        "2035-03-12",
        "2035-03-18",
      ),
    );
    const cards = [...html.matchAll(/data-testid="stretch-details"[^>]*>([\s\S]*?)<\/div>/g)].map(
      (m) => m[1].replace(/<!-- -->/g, ""),
    );
    const withTimes = cards.find((c) => c.includes("Event bkg_1"))!;
    const without = cards.find((c) => c.includes("Event bkg_2"))!;

    expect(withTimes).toContain("Setup: 9:30 am SGT to 10:00 am SGT (30 min)");
    expect(withTimes).toContain("Turnaround: 12:00 pm SGT to 12:45 pm SGT (45 min)");
    expect(without).not.toContain("Setup:");
    expect(without).not.toContain("Turnaround:");
  });
});

describe("AvailabilityCalendar — closed hours (SCRUM-241)", () => {
  // Mon 12 to Sun 18 Mar 2035: Mon–Fri 09:00–18:00, Saturday Closed, no row for Sunday.
  const hours: OpeningDay[] = [
    ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, opensMinute: 9 * 60, closesMinute: 18 * 60 })),
    { weekday: 6, opensMinute: null, closesMinute: null },
  ];
  const week = (extra: Parameters<typeof availabilityByDay>[0] = []) =>
    render(
      availabilityByDay(
        [...closedHours(hours, "2035-03-12", "2035-03-18"), ...extra],
        "2035-03-12",
        "2035-03-18",
      ),
    );
  const list = (html: string, day: string) => {
    const phone = html.slice(html.indexOf('data-view="list"'));
    const start = phone.indexOf(`data-day="${day}"`);
    const end = phone.indexOf("data-day=", start + 1);
    return phone.slice(start, end === -1 ? undefined : end);
  };

  it("SCRUM-241 [AC1] TC-241-06: an open day reads as closed, then available in its opening hours, then closed, on the grid and on a phone", () => {
    const html = week();

    for (const view of [column(html, "2035-03-12"), list(html, "2035-03-12")]) {
      expect(view).toContain("Closed midnight to 9:00 am SGT");
      expect(view).toContain("Available 9:00 am SGT to 6:00 pm SGT");
      expect(view).toContain("Closed 6:00 pm SGT to midnight");
    }
    // An open day is not "Available all day" any more.
    expect(column(html, "2035-03-12")).not.toContain("data-free-all-day");
  });

  it("SCRUM-241 [AC1] TC-241-06: a Closed day says Closed all day at the top of its column, and never Available", () => {
    const html = week();

    for (const day of ["2035-03-17", "2035-03-18"]) {
      expect(column(html, day)).toContain("data-closed-all-day");
      expect(column(html, day)).toContain("Closed all day");
      expect(column(html, day)).not.toContain("Available");
      expect(list(html, day)).toContain("Closed all day");
    }
    expect(html.match(/data-closed-all-day/g)).toHaveLength(2);
  });

  it("SCRUM-241 [AC2] TC-241-07: closed hours are their own kind, with their own label and icon in the legend, and nothing to open", () => {
    const html = week([
      { kind: "booking", id: "bkg_1", startAt: sg("2035-03-12", "10:00"), endAt: sg("2035-03-12", "12:00") },
      { kind: "unavailability", id: "vun_1", startAt: sg("2035-03-13", "10:00"), endAt: sg("2035-03-13", "12:00"), reason: "MAINTENANCE" },
    ]);
    const monday = column(html, "2035-03-12");
    const closed = monday.match(/<li data-kind="closed"[^>]*>/g) ?? [];
    const booked = monday.match(/<li data-kind="booking"[^>]*>/g) ?? [];

    expect(closed).toHaveLength(2);
    // Greyed, not the booking's or the unavailability's colour.
    expect(closed[0]).not.toEqual(booked[0]);
    expect(monday).not.toMatch(/data-kind="closed"[^>]*>\s*<button/);
    const legend = html.slice(html.indexOf('aria-label="Legend"'), html.indexOf("</ul>", html.indexOf('aria-label="Legend"')));
    expect(legend).toContain("Closed");
    expect(legend).toContain("Booked");
    expect(legend).toContain("Unavailable");
    expect(legend).toContain("lucide-door-closed");
  });

  it("SCRUM-241 [AC1] TC-241-06: closed hours from midnight don't scroll the grid to midnight; it still opens at 7 am", () => {
    const html = week();

    expect(html).toContain(`data-scroll-top="${(7 - 0.5) * 56}"`);
  });
});
