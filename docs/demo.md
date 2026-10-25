# Demo script

A walkthrough of ConnectSphere's core workflows with the seeded accounts, for
the sprint review and the Q&A. Each workflow runs end to end and includes at
least one conflict, change or failure, with the story it demonstrates and the
e2e spec that automates the same steps. Created for SCRUM-198.

## Before you start

1. **Reset the seed** so every seeded row is as described here:
   `npm run db:seed`. It deletes nothing, but puts every seeded row back
   (README, "What the seed gives you"). On the shared Supabase database, tell
   the team first: it resets their seeded rows too.
2. Every account's password is `Password123!`. The accounts are listed in the
   README under "Sign in".
3. Use two browser windows (one private) where a step needs two people at once.
4. **Open an event** by clicking its row in **Events** (or **My Events**).
   "Switch to *account*" means sign out and sign in as that account.

The seeded dates are relative to the day you seed. **Planning — Freshman
Orientation** is about three weeks away, 09:00–17:00, for 55 people, with a
pending Seminar Room 2.1 request, a rejected Executive Boardroom request, a
pending equipment request (a projector and two microphones) and a pending
change request to move it one day later.

---

## 1. From request to review

| | |
|---|---|
| **Stories** | SCRUM-13, SCRUM-14 (create and submit), SCRUM-165 (the Lead's queue), SCRUM-18, SCRUM-108 (clarification), SCRUM-19, SCRUM-81 (approve into Planning), SCRUM-67 (permissions) |
| **Automated by** | `e2e/events.spec.ts`, `e2e/lead-queue.spec.ts`, `e2e/clarification.spec.ts`, `e2e/clarification-and-amend.spec.ts`, `e2e/access-control.spec.ts` |

1. As **`organiser@test.local`**, click **Create Event Request** and go to the
   last step with the mandatory fields empty, then **Submit Request for
   Review**. **Failure:** it is refused and the missing fields are marked
   (SCRUM-13 AC4).
2. Fill every step and submit. The request shows **Submitted**.
3. Switch to **`lead@test.local`**: it waits in the **Unassigned Queue**. Open
   it and, under **Assign a Coordinator**, assign **Cody Coordinator**. It
   becomes **Under Review** (SCRUM-165).
4. **Failure:** as **`coordinator@test.local`**, type `/queue` in the address
   bar. The page says **Access denied**: only the Lead assigns (SCRUM-165
   AC10).
5. Open the seeded **Under Review — Career Fair**. Its clarification is
   **Waiting for the organiser's response**: the event stays Under Review, as
   clarification is not a status (SCRUM-18).
6. Switch to **`organiser@test.local`**, open the Career Fair, type an answer
   and **Send response**. Switch back to the coordinator: it shows
   **Organiser responded:** with the answer.
7. In **Events**, click **Approve** on your new request. It goes straight to
   **Planning**; Approved is recorded but never a resting status (SCRUM-81,
   SCRUM-135 AC12).

## 2. Booking a venue, and what is refused

| | |
|---|---|
| **Stories** | SCRUM-50, SCRUM-52, SCRUM-53 (request and decide), SCRUM-40 (suitability), SCRUM-159 (setup and turnaround), SCRUM-162 (several venues) |
| **Automated by** | `e2e/bookings.spec.ts`, `e2e/venue-suitability.spec.ts`, `e2e/setup-turnaround.spec.ts`, `e2e/several-venues.spec.ts` |

1. As **`coordinator@test.local`**, click **Request Venue**, pick
   **Planning — Freshman Orientation**, choose the **Boardroom** layout (only
   venues that support the layout are offered, SCRUM-50 AC1), then the
   **Executive Boardroom**. **Failure:** its capacity, 14, is below the
   event's 55, so the form says so and **Submit request** stays disabled
   (SCRUM-50 TC-50-10).
2. Switch to **`venuestaff@test.local`** and open **Bookings**. The pending
   **Seminar Room 2.1** request for the Freshman Orientation is there.
3. **Failure:** click **Reject** with no reason. It is refused: a rejection
   needs a written reason (SCRUM-53 AC2). Close it without rejecting.
4. Click **Approve**. The Seminar Room is booked for the event.
5. Open **Availability**, pick **Seminar Room 2.1** and go to the event's
   week. The booking is shown, with any setup and turnaround time hatched on
   either side (SCRUM-36, SCRUM-159 AC7).

## 3. Equipment

| | |
|---|---|
| **Stories** | SCRUM-28 (review), SCRUM-155 (reserve in one step), SCRUM-29, SCRUM-156 (availability) |
| **Automated by** | `e2e/equipment-request-review.spec.ts`, `e2e/request-reservation.spec.ts`, `e2e/equipment-availability.spec.ts` |

1. As **`techsupport@test.local`**, open **Equipment**. Check a **Projector**
   for the Freshman Orientation's period with a quantity of 8. **Conflict:**
   three of the ten projectors are in for maintenance, so fewer than 8 are
   available (SCRUM-29).
2. Open **Equipment Requests**, find the Freshman Orientation's request, and
   click **Start review** ("Review started. The coordinator has been
   notified."), then **Approve** ("Request approved. The coordinator has been
   notified.").
3. On **Equipment**, choose it under **Approved request** and click
   **Reserve all 2 item(s)**. Both lines are reserved in one step, or neither
   is (SCRUM-155).

## 4. Safety check and confirmation

| | |
|---|---|
| **Stories** | SCRUM-110 (readiness checklist), SCRUM-166 (safety check), SCRUM-81 (confirm) |
| **Automated by** | `e2e/readiness.spec.ts`, `e2e/safety-check.spec.ts`, `e2e/confirm.spec.ts` |

1. As **`coordinator@test.local`**, open the Freshman Orientation. The
   checklist shows the venue and equipment complete and the safety check
   **Not requested**. **Failure:** **Confirm event** isn't offered yet
   (SCRUM-166 AC9).
2. Click **Request safety check** ("Safety check requested. The Safety
   Officers have been notified.").
3. Switch to **`safety@test.local`**, open **Safety Checks** and the event.
   Everything is read-only: attendance, capacity, layouts, accessibility,
   setup and turnaround, restrictions and notes (SCRUM-166 AC2).
4. **Failure:** choose **Request changes** with no note and click **Record
   outcome**. It is refused: a note, and at least one arrangement, are needed
   (AC3). Then choose **Approve** and **Record outcome**.
5. Switch back to the coordinator and click **Confirm event** ("Event
   confirmed."). Approval alone didn't confirm it (AC14).

## 5. Registration

| | |
|---|---|
| **Stories** | SCRUM-72 (browse), SCRUM-73, SCRUM-74 (register, capacity), SCRUM-77 (withdraw), SCRUM-75 (registration period) |
| **Automated by** | `e2e/attendee-events.spec.ts`, `e2e/registration.spec.ts`, `e2e/withdraw-registration.spec.ts`, `e2e/registration-period.spec.ts` |

1. As **`attendee4@test.local`**, open **One Place Left — Studio
   Masterclass** and register ("You're registered for this event."). It is
   now full.
2. **Conflict:** as **`attendee@test.local`**, open **Full — Wine Tasting
   Evening**. It is full, so there is no register action, and a direct
   request is refused (SCRUM-74).
3. **Failure:** open **Registration Not Yet Open — Summer Camp** and
   **Registration Closed — Leadership Retreat**: neither can be registered
   for (SCRUM-75).
4. Switch back to **`attendee4@test.local`** and withdraw from the
   Masterclass ("You've withdrawn from this event."). The place is free again
   (SCRUM-77).

## 6. Changes: change requests and flagged arrangements

| | |
|---|---|
| **Stories** | SCRUM-41 (raise), SCRUM-128 (decide and apply), SCRUM-26 (flag and resolve), SCRUM-166 AC13 (Outdated check) |
| **Automated by** | `e2e/change-requests.spec.ts`, `e2e/change-decision.spec.ts`, `e2e/reconsideration.spec.ts` |

1. As **`coordinator@test.local`**, open the Freshman Orientation, now
   Confirmed. Its seeded change request moves it one day later: each field
   shows its current and requested value, and the arrangements it could
   affect are listed (SCRUM-128 AC1).
2. **Failure:** leave **Reason for rejecting the change request** empty and
   click **Reject change request**. It is refused (AC3).
3. Click **Approve**. In one step the dates change, the event goes **back to
   Planning**, its venue booking and equipment reservations are flagged
   **Needs Reconsideration**, and the safety check becomes **Outdated**
   (SCRUM-128 AC2, AC4, AC5).
4. **Failure:** on the flagged Seminar Room booking, click **Still stands**.
   It is refused with the reason: the booking keeps its original day, so it
   no longer covers the event's period (SCRUM-26 AC6, AC8).
5. Click **Cancel arrangement**. Only that booking is cancelled; nothing was
   cancelled until the Coordinator chose to (SCRUM-26 AC9, AC11).

## 7. Week 7: holds, unavailability, setup and turnaround

| | |
|---|---|
| **Stories** | SCRUM-163 (holds), SCRUM-161, SCRUM-37 (unavailability), SCRUM-160 (clashes after a longer setup or turnaround) |
| **Automated by** | `e2e/holds.spec.ts`, `e2e/availability.spec.ts`, `e2e/setup-turnaround-clashes.spec.ts` |

1. As **`coordinator@test.local`**, **Request Venue** for the Freshman
   Orientation's new day at **Seminar Room 2.1**, with the **Classroom**
   layout. The cancelled booking doesn't stop a new request (SCRUM-162 AC2).
2. Switch to **`venuestaff@test.local`**. In **Bookings**, click **Hold** on
   it, set a deadline before the event starts, and **Hold venue**. The venue
   is held, not booked. **Failure:** a deadline after the event starts is
   refused (SCRUM-163 AC1).
3. Open **Availability** for Seminar Room 2.1 and click **Record
   unavailability** over the held period (for example maintenance). It is
   allowed over a booking, which is flagged rather than removed: the button
   reads **Record and flag 1 booking** (SCRUM-161).
4. Open **Venues** → **Grand Auditorium** → **Edit venue** and lengthen its
   turnaround time. If any upcoming bookings there would now clash, you are
   shown them first and the button reads **Save and flag …**; nothing is
   moved or cancelled (SCRUM-160 AC1, AC2).

## 8. Closing an event, and permissions

| | |
|---|---|
| **Stories** | SCRUM-82 (cancel and complete), SCRUM-67, SCRUM-68, SCRUM-84 (permissions and ownership) |
| **Automated by** | `e2e/close-event.spec.ts`, `e2e/access-control.spec.ts`, `e2e/events.spec.ts` (SCRUM-84 AC1) |

1. As **`coordinator@test.local`**, open the Freshman Orientation and click
   **Cancel event**. **Failure:** with an empty **Cancellation reason** it is
   refused. With a reason: "Event cancelled. Its arrangements and
   registrations were released." Every booking, hold, reservation and open
   request is released in the same step (SCRUM-82 AC3).
2. Open **Completed — Hackathon**: it is Completed, with no status actions
   left. A Confirmed event becomes Completed by itself the first time it is
   read after its end time, with no scheduled job (SCRUM-82 AC7).
3. As **`organiser@test.local`**, open **My Events**. **Another Client's
   Event — Product Launch**, owned by `organiser2@test.local`, isn't listed:
   an organiser sees only their own events (SCRUM-84 AC1, SCRUM-68).
4. **Failure:** still as the organiser, type `/bookings` in the address bar.
   The page says **Access denied**: the server refuses it, not just the menu
   (SCRUM-67).

When you're done, run `npm run db:seed` again to put the seeded rows back.
