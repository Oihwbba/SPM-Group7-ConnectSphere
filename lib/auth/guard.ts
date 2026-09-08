import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { auth } from "@/auth";

/**
 * Page-level session guard for server components. Middleware already blocks
 * unauthenticated requests to the app, but a page should still fetch its own
 * session (to read the user) and treat "no session" defensively.
 *
 * Role checks that decide whether *this* role may see *this* route are done in
 * the page itself against an explicit allow-list, then rendered as <Forbidden/>
 * — see any placeholder page for the pattern. Authorisation of data-changing
 * actions is done by `requirePermission` in the action, never here.
 */
export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}
