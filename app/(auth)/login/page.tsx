import { AnimatedSphere } from "@/components/auth/animated-sphere";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Left: the animated sphere. Hidden on small screens where it would
          crowd the form. */}
      <div className="relative hidden lg:block">
        <AnimatedSphere />
      </div>

      {/* Right: the sign-in card. */}
      <div className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in to your ConnectSphere account.
            </p>
          </div>

          <LoginForm />

          {/* Local dev convenience — all seeded accounts share this password.
              Safe to keep: seed data only exists locally and in CI. */}
          <div className="glass-panel-sm mt-8 rounded-lg p-4 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Demo accounts</p>
            <p>
              organiser@test.local · coordinator@test.local ·
              venuestaff@test.local · techsupport@test.local ·
              attendee@test.local
            </p>
            <p className="mt-1">
              Password for all: <code className="font-mono">Password123!</code>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
