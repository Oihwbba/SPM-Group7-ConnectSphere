import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config. This half contains NO database or bcrypt code so
 * it can run in Next.js middleware (the Edge runtime). The Credentials
 * provider — which needs Prisma and bcrypt — is added in auth.ts, which only
 * runs in the Node runtime.
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
        token.role = user.role;
      }
      return token;
    },

    /**
     * Copy `id` and `role` from the token onto the session so server
     * components and actions can read `session.user.role`.
     */
    session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
