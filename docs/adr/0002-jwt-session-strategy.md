# ADR 0002 — Use the JWT session strategy

Stories: SCRUM-65.

## Context

We authenticate users with Auth.js (NextAuth v5) using the Credentials
provider — email and password checked against our own `User` table — because
the customer's users are seeded accounts, not social logins. We also install
the Prisma adapter, which by default stores sessions as rows in a `Session`
table ("database sessions").

There is a well-known trap here: **the Credentials provider does not work with
database sessions.** Auth.js only creates a database session row for providers
that complete an OAuth-style callback flow; a Credentials sign-in returns a
user object directly and Auth.js expects that path to issue a JWT. Left on the
default, sign-in appears to succeed but no usable session is produced.

## Decision

Set `session: { strategy: "jwt" }` explicitly (in `auth.config.ts`). The
session is a signed cookie, not a database row. Because a JWT does not
automatically carry our custom fields, we copy them across ourselves:

- in the `jwt` callback, put `id` and `role` onto the token on sign-in;
- in the `session` callback, copy `id` and `role` from the token onto
  `session.user`.

We also type-augment `Session` and `JWT` (in `types/next-auth.d.ts`) so
`session.user.role` is a typed `Role` everywhere, which the authorisation
module (ADR 0004) depends on.

The Prisma adapter is still installed, as the brief requires, and manages the
`User`/`Account` tables; it simply is not the source of sessions.

## Alternatives rejected

- **Database sessions** (the adapter default). Does not function with the
  Credentials provider, as above.
- **Skipping the adapter entirely.** We would lose the standard user/account
  tables and the option to add an OAuth provider later. Keeping the adapter
  costs nothing and keeps that door open.

## Consequences

- Sessions are stateless: no session table reads on every request, so the
  proxy can validate a request by decoding the cookie without a database call.
  (This was written when the entry point was Edge middleware. Next.js 16
  renamed that convention to `proxy.ts`, which always runs on the Node.js
  runtime — the argument is unchanged, and `auth.config.ts` stays free of
  Prisma and bcrypt so the proxy remains cheap.)
- `role` lives in the token, so changing a user's role only takes effect on
  their next sign-in. Acceptable for this system; noted so nobody is surprised.
- Every server action and page can trust `session.user.role` as a typed value.

## Addendum (2026-10-29) — Role changes and sign-out (SCRUM-216)

The SCRUM-216 epic check recorded two consequences of the JWT strategy. The
Product Owner (Hann Qian) accepted both for Release 1 on 30 October 2026:

- **A role change takes effect at the next sign-in.** The token carries
  `role` and, since SCRUM-121, `additionalRoles`, so a role granted or removed
  in the database doesn't change what an existing session can do until that
  user signs in again. Every relationship is still read from the database at
  the time of the request (ADR 0004), so a reassigned event leaves the old
  Coordinator's reach at once; only the role itself waits.
- **Signing out clears the browser's cookie but doesn't revoke the token.**
  A copy of the token taken before sign-out stays valid until it expires
  (Auth.js's default, 30 days, since `auth.config.ts` sets no `maxAge`). There
  is no session table to delete a row from: that is the trade-off this ADR
  made.

Revoking either would need state on every request (a session table, or a
token version on `User` checked in the `jwt` callback), which is what this ADR
chose to avoid; it is recorded here as future work, not Release 1.
