# Design reference

A few key diagrams and the Server Actions reference, kept next to the code for
quick reference while working on it. The team's full design pack (C4, data
model, sequences, business processes and the rest) lives in a separate design
document, outside the repo.

- [`api.md`](api.md): every Server Action, with its permission, input, the
  tables it writes and the rows it locks.
- The diagrams below, exported from the design pack as SVG images.

**Last checked against the code:** 2026-10-11, `main` at commit `885c837`, the
open pull requests named below, and the Jira stories each diagram cites
(SCRUM-175).

## Diagrams

| Diagram | Status | Notes |
|---|---|---|
| [Containers](diagrams/c4-2-containers.svg) (C4 level 2) | Built | What runs where: the browser, the one Next.js app, PostgreSQL on Supabase, and Prisma migrations and seed. Each person's description lists their Release 1 duties, not only what's built today. |
| [Components of the web application](diagrams/c4-3-components.svg) (C4 level 3) | Mixed | Which module does what. Solid boxes are on `main`, orange dashed ones are in open pull requests, and grey dashed ones are planned Sprint 3 stories. The venue catalogue, search and suitability (SCRUM-34, 38 and 40) are built on `main`; the other boxes' statuses date from when the diagram was drawn. |
| [Event status, Release 1 target](diagrams/state-01-event-target.svg) | Target | SCRUM-135, with the Lead's queue (SCRUM-165) and the safety check (SCRUM-166). The lifecycle as built is in [`docs/product-context.md`](../product-context.md). |
| [Venue booking](diagrams/state-03-booking.svg) | Target | Statuses with holds (SCRUM-163, #154) and the Needs Reconsideration flag (SCRUM-26). |
| [Safety check](diagrams/state-05-safety-check.svg) | Target | SCRUM-166. |

**Built** means everything shown is on `main`, **Target** means Release 1
after the Week 7 changes, and **Mixed** means part of each. A Built diagram has
to change when the code it shows changes. To fix a label, edit its text in the
SVG. To change a diagram's shape, export it again from the design pack.

## Corrected from the design pack

The components diagram said every Server Action calls `requirePermission()`
first and then a Zod schema. Three read actions check `can()` directly and take
only an event id, so its two labels now say so.

## How these were checked

- **Containers and components:** every file, constraint and trigger named exists on `main`, or in the pull request named.
- **The three state machines:** compared with the current criteria of SCRUM-26, 135, 163, 165 and 166.
- **[`api.md`](api.md):** each action was read from `app/` by script, then checked by hand for nested writes and locks taken in helpers.
- **Safety, enforced in CI:** `.gitattributes` keeps the SVGs out of the GLM review's diff, so `tests/unit/design-diagrams.test.ts` checks them instead. It fails if a diagram gains a script, an event handler, a link or stylesheet URL outside its own file, or anything but plain label markup inside a `foreignObject`, and if this index stops linking every diagram exactly once.
