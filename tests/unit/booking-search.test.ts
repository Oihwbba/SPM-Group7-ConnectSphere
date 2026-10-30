import { describe, it, expect } from "vitest";

import {
  bookingSearchText,
  type SearchableBooking,
} from "@/app/(app)/bookings/search";
import { arrangeQueue, type QueueItem, type QueueView } from "@/lib/queues";

// SCRUM-52 AC1 (TC-52-05) and SCRUM-211 AC2 — Bookings' one search box finds
// a request by any of the words SCRUM-52 searched, through the search every
// queue shares. Test cases: docs/testing/SCRUM-52.md, docs/testing/SCRUM-211.md.

const row: SearchableBooking = {
  event: { name: "Approved — Research Symposium" },
  venue: { name: "Exhibition Hall", location: "Level 1, Block C" },
  requestedBy: { name: "Cody Coordinator", email: "coordinator@test.local" },
  requestedLayout: "banquet",
  requestNotes: null,
  requiredFacilities: ["projector", "stage"],
  startAt: new Date("2035-03-10T01:00:00.000Z"),
  endAt: new Date("2035-03-10T05:00:00.000Z"),
};

// As the Bookings page lists it: the event's name, plus the search text.
const item = (booking: SearchableBooking, id = "bkg_1"): QueueItem => ({
  id,
  event: booking.event.name,
  eventStart: booking.startAt,
  asked: `${booking.venue.name} for 250`,
  searchText: bookingSearchText(booking),
  requestedAt: new Date("2035-01-01T01:00:00.000Z"),
  waiting: true,
  badges: [],
});

const view = (q: string): QueueView => ({
  status: "all",
  q,
  sort: "requested",
  dir: "asc",
  open: null,
  done: false,
});

const matchesSearch = (booking: SearchableBooking, query: string) =>
  arrangeQueue([item(booking)], view(query.trim())).length === 1;

describe("SCRUM-52 — the Bookings search", () => {
  it("SCRUM-52 [AC1] TC-52-05: matches on event, venue, location, coordinator, email, facility, layout and date, ignoring case", () => {
    for (const query of [
      "research symposium",
      "EXHIBITION",
      "block c",
      "cody",
      "coordinator@test.local",
      "stage",
      "banquet",
      "10 Mar 2035",
    ]) {
      expect(matchesSearch(row, query), query).toBe(true);
    }
  });

  it("SCRUM-52 [AC1] TC-52-05: every word must match somewhere, so extra words narrow the results", () => {
    expect(matchesSearch(row, "hall projector")).toBe(true);
    expect(matchesSearch(row, "hall boardroom")).toBe(false);
  });

  it("SCRUM-52 [AC1] TC-52-05: an empty or blank search shows everything", () => {
    expect(matchesSearch(row, "")).toBe(true);
    expect(matchesSearch(row, "   ")).toBe(true);
  });

  it("SCRUM-52 [AC1] TC-52-05: the notes are searched too, when there are any", () => {
    expect(matchesSearch(row, "catering")).toBe(false);
    expect(
      matchesSearch({ ...row, requestNotes: "Catering at noon" }, "catering"),
    ).toBe(true);
  });
});

describe("SCRUM-211 — the same search box, finding Bookings by venue and Coordinator", () => {
  it("SCRUM-211 [AC2] TC-211-15: the Bookings search finds a request by its venue and by its Coordinator, and not another's", () => {
    const other: SearchableBooking = {
      ...row,
      event: { name: "Freshman Fair" },
      venue: { name: "Seminar Room 2.1", location: "Level 2, Block B" },
      requestedBy: {
        name: "Cara Coordinator",
        email: "coordinator2@test.local",
      },
    };
    const items = [item(row, "hall"), item(other, "seminar")];
    const found = (q: string) => arrangeQueue(items, view(q)).map((i) => i.id);

    expect(found("exhibition hall")).toEqual(["hall"]);
    expect(found("seminar")).toEqual(["seminar"]);
    expect(found("Cody")).toEqual(["hall"]);
    expect(found("cara coordinator")).toEqual(["seminar"]);
    // Both are Coordinators: one word that is in both finds both.
    expect(found("coordinator")).toEqual(["hall", "seminar"]);
  });
});
