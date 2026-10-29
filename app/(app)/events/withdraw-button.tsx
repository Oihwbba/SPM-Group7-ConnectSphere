"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import { withdrawRegistration } from "./registration-actions";

/** SCRUM-74/77 — the working half of the Withdraw button the event page and
 * My Registrations render once the caller is registered. A client component,
 * since only the click handler needs to run in the browser. SCRUM-212 AC2,
 * SCRUM-207 AC5: it asks first, in the shared confirmation dialog, and a
 * refusal stays in the dialog. */
export function WithdrawButton({
  registrationId,
  eventName,
  afterWithdrawHref,
}: {
  registrationId: string;
  eventName: string;
  /** SCRUM-85 AC9: where to go once withdrawn, when this page is no longer
   * the Attendee's to see; otherwise the page refreshes in place. */
  afterWithdrawHref?: string;
}) {
  const router = useRouter();

  async function handleWithdraw() {
    const result = await withdrawRegistration({ registrationId });
    if (!result.ok) return result;
    toast.success("You've withdrawn from this event.");
    if (afterWithdrawHref) router.push(afterWithdrawHref);
    else router.refresh();
    return result;
  }

  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="outline"
          className="h-11 sm:h-10"
          data-testid="withdraw-button"
        >
          Withdraw
        </Button>
      }
      title="Withdraw from this event?"
      message={`Your place at ${eventName} will go to someone else. You can register again while registration is open and places are left.`}
      confirmLabel="Withdraw"
      pendingLabel="Withdrawing…"
      cancelLabel="Keep my place"
      destructive
      onConfirm={handleWithdraw}
      testId="withdraw-dialog"
    />
  );
}
