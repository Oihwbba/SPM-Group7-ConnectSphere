"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { registerForEvent } from "./registration-actions";

/** SCRUM-73 — the working half of the Register button the detail page
 * renders. Split into its own client component because attendee-event-
 * detail.tsx is a server component (it receives the already-fetched event
 * as a prop); only the click handler needs to run in the browser. */
export function RegisterButton({
  eventId,
  disabled,
}: {
  eventId: string;
  disabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleRegister() {
    startTransition(async () => {
      const result = await registerForEvent({ eventId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("You're registered for this event.");
      router.refresh();
    });
  }

  return (
    <Button
      disabled={disabled || isPending}
      onClick={handleRegister}
      data-testid="register-button"
    >
      {isPending ? "Registering..." : "Register"}
    </Button>
  );
}
