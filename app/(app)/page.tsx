import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LANDING_ROUTE_BY_ROLE } from "@/lib/nav";

/**
 * The app root. It holds no UI of its own — it just sends each role to their
 * landing page. Keeping this redirect in one place means "where does an
 * Organiser start?" is answered by the nav map, not scattered across the app.
 */
export default async function AppHome() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  redirect(LANDING_ROUTE_BY_ROLE[session.user.role]);
}
