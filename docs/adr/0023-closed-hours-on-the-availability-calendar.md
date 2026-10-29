# ADR 0023 — Closed hours are a kind of stretch on the availability calendar, shown under everything else

## Context

The availability calendar (SCRUM-36) showed every hour of every day as
available, including the hours a venue is closed (SCRUM-241). Booking outside
opening hours has been refused since SCRUM-34 AC7, so the calendar offered
times that couldn't be booked. SCRUM-36 AC1 says the calendar shows the
venue's available and unavailable periods.

## Decision

1. **Closed hours are their own kind of calendar entry, `closed`.**
   `closedHours()` in `lib/venue-availability.ts` turns a venue's opening
   hours into stretches for the week: midnight to opening, closing to
   midnight, and the whole of a Closed day. The page adds them to the bookings
   and unavailability it already shows, and `availabilityByDay()` lays them
   out like any other entry, so closed hours meet a booking at opening or
   closing with no gap (AC3).
2. **They read the hours the same way the booking rules do** (SCRUM-34 AC7,
   `lib/venue-hours.ts`): a weekday with no row is Closed, a venue with no
   hours recorded is never closed (AC4), and exactly at opening or closing is
   inside the hours.
3. **They are shown under everything else.** Where a booking, its setup or
   turnaround, or recorded unavailability falls in closed hours, that is what
   the calendar shows. SCRUM-159 AC9 lets a turnaround run past closing, and
   maintenance recorded overnight says more than "Closed" does.
4. **They are greyed out, with a door icon and the label "Closed"**, unlike a
   booking (solid blue) or unavailability (striped amber), and have nothing to
   hover or open (AC2). A Closed day says "Closed all day" at the top of its
   column, as an empty day says "Available all day". Closed hours from
   midnight don't move where the grid opens, which stays at 7 am.

## Alternatives rejected

- **Show closed hours as recorded unavailability.** It would read as
  maintenance or a safety concern with a reason and a recorder, which closed
  hours don't have, and AC2 asks for them to look different.
- **Crop the grid to each day's opening hours.** Days with different hours
  wouldn't line up, and a turnaround past closing would have nowhere to show.
- **Add the stretches inside `findVenueCalendar`.** It loads what's in the
  database for a period: bookings and unavailability. Closed hours are worked
  out from the opening hours, without a query per day, so they are a pure
  function the page combines with it. They can then be tested without a
  database, and the query keeps one job.

## Consequences

- Every seeded venue has opening hours, so the calendar's e2e journeys now see
  closed stretches at night. Their expected results changed with this fix
  (SCRUM-36 TC-36-01, TC-36-03, TC-36-04).
- The calendar makes one more small query per page (the venue's seven
  opening-hours rows), run alongside the bookings query.
- Tests: [docs/testing/SCRUM-241.md](../testing/SCRUM-241.md).
