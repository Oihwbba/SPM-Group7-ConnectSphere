import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { primaryRoleLabel, rolesLabel } from "@/lib/nav";
import { rolesOf } from "@/lib/auth/can";
import { MobileNav, Sidebar } from "@/components/app/sidebar";
import { SphereLogo } from "@/components/app/sphere-logo";
import { UserMenu } from "@/components/app/user-menu";
import { NotificationBell } from "@/components/app/notification-bell";
import { DevelopmentNotice } from "@/components/app/development-notice";
import { getMyUnreadCount } from "./notifications/queries";

/**
 * The shell wrapping every authenticated page.
 *
 * Layout is a "T": a full-width top bar (brand + profile) across the
 * top, and below it the collapsible left nav rail beside the page content. The
 * rail starts under the top bar, so it never overlaps it.
 *
 * Middleware already blocks unauthenticated requests, but we read the session
 * here too — both to pick the role's nav and as defence in depth.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { name, email } = session.user;
  // SCRUM-121: every role the user holds, the primary one first.
  const roles = rolesOf(session.user);
  const unread = await getMyUnreadCount();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Scrolls away with the page, so the sticky top bar keeps its height. */}
      <DevelopmentNotice variant="strip" />
      {/* Top section — spans the full width, above everything else. */}
      {/* Tight on a phone so the hamburger doesn't push the brand out of the
          left of the bar (SCRUM-168 AC3); the usual spacing from sm up. */}
      <header className="sticky top-0 z-50 flex h-16 items-center gap-1 bg-background/70 px-3 backdrop-blur-glass sm:gap-4 sm:px-6">
        <MobileNav roles={roles} />
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <SphereLogo className="h-7 w-7 sm:h-9 sm:w-9" />
          <span className="text-lg tracking-tight">
            <span className="font-bold">Connect</span>
            <span className="font-light">Sphere</span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <NotificationBell unread={unread} />
          <UserMenu
            name={name ?? "User"}
            email={email ?? ""}
            roleLabel={primaryRoleLabel(roles)}
            allRolesLabel={rolesLabel(roles)}
          />
        </div>
      </header>

      {/* Below the top bar: nav rail + page content. */}
      <div className="flex flex-1">
        <Sidebar roles={roles} />
        {/* Nothing floats over the page now that a phone's menu is the panel
            behind the hamburger, so no extra bottom padding is needed. */}
        <main className="min-w-0 flex-1 px-4 pb-10 pt-4 sm:px-6 md:pt-6">
          {children}
        </main>
      </div>
    </div>
  );
}
