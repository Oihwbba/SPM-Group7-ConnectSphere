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

declare module "next-auth/jwt" {
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
