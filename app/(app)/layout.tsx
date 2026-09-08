import { redirect } from "next/navigation";
import { Search } from "lucide-react";

import { auth } from "@/auth";
import { ROLE_LABEL } from "@/lib/nav";
import { Sidebar } from "@/components/app/sidebar";
import { SphereLogo } from "@/components/app/sphere-logo";
import { UserMenu } from "@/components/app/user-menu";
import { Input } from "@/components/ui/input";

/**
 * The shell wrapping every authenticated page.
 *
 * Layout is a "T": a full-width top bar (brand + search + profile) across the
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

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top section — spans the full width, above everything else. */}
      <header className="sticky top-0 z-50 flex h-16 items-center gap-4 bg-background/70 px-4 backdrop-blur-glass sm:px-6">
        <div className="flex items-center gap-2">
          <SphereLogo className="h-9 w-9" />
          <span className="hidden text-lg tracking-tight sm:inline">
            <span className="font-bold">Connect</span>
            <span className="font-light">Sphere</span>
          </span>
        </div>

        {/* Global search is a visual placeholder for now — a feature team
            wires it up later. */}
        <div className="relative ml-2 hidden w-full max-w-xs md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search…"
            aria-label="Search"
            className="rounded-full pl-9"
          />
        </div>

        <div className="ml-auto flex items-center gap-1">
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
        <main className="min-w-0 flex-1 px-4 pb-10 pt-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
