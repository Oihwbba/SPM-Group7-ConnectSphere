"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { withdrawRegistration } from "./registration-actions";

/** SCRUM-74/77 (partial) — the working half of the Withdraw button the
 * detail page renders once the caller is registered. Same split as
 * ./register-button.tsx: attendee-event-detail.tsx is a server component, so
 * only the click handler needs to run in the browser. */
export function WithdrawButton({
  registrationId,
  afterWithdrawHref,
}: {
  registrationId: string;
  /** SCRUM-85 AC9: where to go once withdrawn, when this page is no longer
   * the Attendee's to see; otherwise the page refreshes in place. */
  afterWithdrawHref?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleWithdraw() {
    startTransition(async () => {
      const result = await withdrawRegistration({ registrationId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("You've withdrawn from this event.");
      if (afterWithdrawHref) router.push(afterWithdrawHref);
      else router.refresh();
    });
  }

  return (
    <Button
      variant="outline"
      disabled={isPending}
      onClick={handleWithdraw}
      data-testid="withdraw-button"
    >
      {isPending ? "Withdrawing..." : "Withdraw"}
    </Button>
  );
}
