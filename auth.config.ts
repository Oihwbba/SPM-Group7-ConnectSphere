import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" &&
    [
      "ORGANISER",
      "COORDINATOR",
      "VENUE_STAFF",
      "TECH_SUPPORT",
      "ATTENDEE",
    ].includes(value)
  );
}

/**
 * Lightweight half of the Auth.js config. It contains NO database or bcrypt
 * code, so `proxy.ts` can import it without dragging Prisma into every
 * request. The Credentials provider — which needs Prisma and bcrypt — is added
 * in auth.ts. (Before Next.js 16 this split was forced by the Edge runtime;
 * `proxy` runs on Node now, but keeping the split still keeps the proxy cheap.)
 *
 * TRAP (see docs/adr/0002): the Credentials provider does not work with
 * database sessions, so we force the JWT session strategy here and carry
 * `id` and `role` on the token ourselves.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  // Trust the Host header of the incoming request when building callback URLs.
  //
  // Without this, every deployed request fails with
  // `UntrustedHost: Host must be trusted` and sign-in is impossible — Auth.js
  // refuses to build a callback URL from a Host it has not been told to trust.
  // It is set here rather than through the AUTH_TRUST_HOST environment
  // variable so the app cannot be deployed with it forgotten again.
  //
  // Safe because we run behind Vercel's proxy, which terminates TLS and
  // rewrites Host to the real deployment domain — a client cannot spoof it.
  // If this app is ever self-hosted behind a proxy that passes an
  // attacker-controlled Host through, revisit this: a forged Host would let an
  // attacker point callback URLs at their own domain.
  trustHost: true,
  // Real providers are added in auth.ts. Middleware never needs them.
  providers: [],
  callbacks: {
    /**
     * Runs in middleware for every matched request. Returning false (or a
     * redirect) blocks the request. This is the single gate that protects the
     * whole authenticated area server-side — not just hidden nav links.
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");

      if (isOnLogin) {
        // Signed-in users have no reason to see the login page.
        if (isLoggedIn) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      // Everything else is behind auth.
      return isLoggedIn;
    },

    /**
     * Put `id` and `role` onto the token when the user signs in. `user` is
     * only present on the initial sign-in; afterwards we just pass the token
     * through.
     */
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        if (isRole(user.role)) token.role = user.role;
      }
      return token;
    },

    /**
     * Copy `id` and `role` from the token onto the session so server
     * components and actions can read `session.user.role`.
     */
    session({ session, token }) {
      if (typeof token.id === "string") {
        session.user.id = token.id;
      }
      if (isRole(token.role)) {
        session.user.role = token.role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
