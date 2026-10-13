import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ROLE_LABEL } from "@/lib/nav";
import { Sidebar } from "@/components/app/sidebar";
import { SphereLogo } from "@/components/app/sphere-logo";
import { UserMenu } from "@/components/app/user-menu";
import { NotificationBell } from "@/components/app/notification-bell";
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

  const { role, name, email } = session.user;
  const unread = await getMyUnreadCount();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top section — spans the full width, above everything else. */}
      <header className="sticky top-0 z-50 flex h-16 items-center gap-4 bg-background/70 px-4 backdrop-blur-glass sm:px-6">
        <div className="flex items-center gap-2">
          <SphereLogo className="h-9 w-9" />
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
            roleLabel={ROLE_LABEL[role]}
          />
        </div>
      </header>

      {/* Below the top bar: nav rail + page content. */}
      <div className="flex flex-1">
        <Sidebar role={role} />
        {/* Extra bottom padding on mobile so content clears the fixed bottom
            nav bar; the desktop rail is in-flow so needs none. */}
        <main className="min-w-0 flex-1 px-4 pb-24 pt-4 sm:px-6 md:pb-10 md:pt-6">
          {children}
        </main>
      </div>
    </div>
  );
}
