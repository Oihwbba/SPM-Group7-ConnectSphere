import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { AvailabilityCalendar } from "@/app/(app)/venues/availability/availability-calendar";
import { availabilityByDay } from "@/lib/venue-availability";

// SCRUM-36 — what the week grid says about a day. Rendering only.
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
});
