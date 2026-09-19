import { AnimatedSphere } from "@/components/auth/animated-sphere";
import { SphereLogo } from "@/components/app/sphere-logo";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Left: the animated sphere as a full column on large screens. Hidden
          below lg, where a compact sphere sits beside the heading instead. */}
      <div className="relative hidden lg:block">
        <AnimatedSphere />
      </div>

      {/* Right: the sign-in card. */}
      <div className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                Welcome back
              </h1>
              {/* A small sphere to the right of the heading on small screens
                  (the big left-column sphere shows instead at lg). */}
              <SphereLogo className="h-10 w-10 lg:hidden" />
            </div>
            <p className="text-sm text-muted-foreground">
              Sign in to your ConnectSphere account.
            </p>
          </div>

          <LoginForm />

          {/* Demo-account hint — a local/dev convenience only. NEVER rendered in
              production: the shared Supabase database is seeded there too, so
              these would be working live credentials published on a public page.
              Gated on NODE_ENV, which is "production" in the built app. */}
          {process.env.NODE_ENV !== "production" && (
            <div className="glass-panel-sm mt-8 rounded-lg p-4 text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Demo accounts</p>
              <p>
                organiser@test.local · coordinator@test.local ·
                venuestaff@test.local · techsupport@test.local ·
                attendee@test.local
              </p>
              <p className="mt-1">
                Password for all:{" "}
                <code className="font-mono">Password123!</code>
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
