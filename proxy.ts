import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Next.js 16 renamed the `middleware` convention to `proxy`. Unlike middleware,
// `proxy` always runs on the NODE.JS runtime — the edge runtime is not
// supported here and the runtime cannot be configured.
//
// We still import the edge-safe half of the Auth.js config (no Prisma, no
// bcrypt). That split is no longer forced by the runtime, but it stays because
// it keeps this entry point cheap and is what docs/adr/0002 describes. The
// `authorized` callback in auth.config.ts decides what is allowed.
export const proxy = NextAuth(authConfig).auth;

export default proxy;

export const config = {
  // Protect everything except Next.js internals, the auth API routes, and
  // static asset files. The login page IS matched (so signed-in users get
  // redirected away from it) but the `authorized` callback lets it through
  // for signed-out users.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\..*).*)"],
};
