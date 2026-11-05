# Design reference

A few key diagrams and the Server Actions reference, kept next to the code for
quick reference while working on it. The team's full design pack (C4, data
model, sequences, business processes and the rest) lives in a separate design
document, outside the repo.

- [`api.md`](api.md): every Server Action, with its permission, input, the
  tables it writes and the rows it locks.
- The diagrams below, exported from the design pack as SVG images.

**Last checked against the code:** 2026-11-03, `main` at commit `8db5be5e`,
and the Jira stories each diagram cites (SCRUM-275). **Last checked against
the submitted design document:** 2026-11-06, `main` at commit `cecb1b3`.

## The C4 levels

The design document submitted with the project, "Architecture and Design
Diagrams" (submission folder 2, System Design), is the source of truth for
every diagram. The course asks for C4 levels 1 and 2.

| C4 level | In the design document | In this repo |
|---|---|---|
| 1, System context | Figure 1: ConnectSphere and the seven roles that use it | Not kept here. It shows the people and the one outside system, which don't change when the code does, so Figure 1 is the only copy. |
| 2, Containers | Figure 2 | `c4-2-containers.svg`, below. Matches Figure 2: on 2026-11-06 its one differing label, on the arrow to the database, was changed to Figure 2's "Reads and writes in transactions; row locks". |
| 3, Components | Not included, as the course doesn't ask for it | `c4-3-components.svg`, below, kept for working on the code. |

If a diagram here and the design document disagree, the design document is
right and the diagram here is corrected to match it. If the code changes what
a diagram shows, both are updated.

## Diagrams

| Diagram | Status | Notes |
|---|---|---|
| [Containers](diagrams/c4-2-containers.svg) (C4 level 2) | Built | What runs where: the browser, the one Next.js app, PostgreSQL on Supabase, and Prisma migrations and seed. Each person's description lists their Release 1 duties, not only what's built today. |
| [Components of the web application](diagrams/c4-3-components.svg) (C4 level 3) | Built | Which module does what. Every box is on `main`. |
| [Event status, Release 1 target](diagrams/state-01-event-target.svg) | Built | SCRUM-135, with the Lead's queue (SCRUM-165) and the safety check (SCRUM-166). Not shown: an overdue event can be rejected or cancelled but not approved or confirmed (SCRUM-249). The same lifecycle is in [`docs/product-context.md`](../product-context.md). |
| [Venue booking](diagrams/state-03-booking.svg) | Built | Statuses with holds (SCRUM-163, #154) and the Needs Reconsideration flag (SCRUM-26). |
| [Safety check](diagrams/state-05-safety-check.svg) | Built | SCRUM-166. |

**Built** means everything shown is on `main`, **Target** means Release 1
after the Week 7 changes, and **Mixed** means part of each. A Built diagram has
to change when the code it shows changes. To fix a label, edit its text in the
SVG. To change a diagram's shape, export it again from the design pack.

## Corrected from the design pack

The components diagram said every Server Action calls `requirePermission()`
first and then a Zod schema. Three read actions check `can()` directly and take
only an event id, so its two labels now say so.

On 2026-11-03 (SCRUM-275) the boxes drawn as in review or planned were redrawn
as built, since all of that work has merged, and the legend lost those two
styles. The Coordinator assignment box no longer describes SCRUM-20's
automatic assignment under an advisory lock: the Lead assigns, and the
least-loaded Coordinator is only suggested. The containers diagram no longer
mentions advisory locks, which the app doesn't take.

## How these were checked

- **Containers and components:** every file, constraint and trigger named exists on `main`.
- **The three state machines:** compared with the current criteria of SCRUM-26, 135, 163, 165 and 166.
- **[`api.md`](api.md):** each action was read from `app/` by script, then checked by hand for nested writes and locks taken in helpers.
- **Safety, enforced in CI:** `.gitattributes` keeps the SVGs out of the GLM review's diff, so `tests/unit/design-diagrams.test.ts` checks them instead. It fails if a diagram gains a script, an event handler, a link or stylesheet URL outside its own file, or anything but plain label markup inside a `foreignObject`, and if this index stops linking every diagram exactly once.
