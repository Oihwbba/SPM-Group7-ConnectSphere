import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Middleware runs on the Edge runtime, so it uses only the edge-safe config
// (no Prisma, no bcrypt). The `authorized` callback in auth.config.ts decides
// what is allowed.
export default NextAuth(authConfig).auth;

export const config = {
  // Protect everything except Next.js internals, the auth API routes, and
  // static asset files. The login page IS matched (so signed-in users get
  // redirected away from it) but the `authorized` callback lets it through
  // for signed-out users.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
