import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

/**
 * Type augmentation so `session.user.id` and `session.user.role` are typed
 * everywhere. Without this, TypeScript only knows about the default Auth.js
 * session shape (name/email/image) and every `can()` call would be untyped.
 *
 * The values are put onto the token in the `jwt` callback and copied onto the
 * session in the `session` callback (see auth.config.ts).
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  // The object returned by the Credentials `authorize` callback.
  interface User {
    role: Role;
  }
}

// Augment "@auth/core/jwt", NOT "next-auth/jwt". In NextAuth v5 the latter is
// a bare `export * from "@auth/core/jwt"` and declares no `JWT` of its own, so
// augmenting it silently creates a SECOND, unrelated interface: the real `JWT`
// extends `Record<string, unknown>`, and `token.id` stays `unknown`.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}

// The `jwt` callback receives `User | AdapterUser`, so `AdapterUser` needs the
// same `role` for `user.role` to type-check there.
declare module "@auth/core/adapters" {
  interface AdapterUser {
    role: Role;
  }
}
