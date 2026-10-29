"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** What a confirmed action reports back; an `ActionResult` fits as it is. */
export type ConfirmOutcome = { ok: true } | { ok: false; error: string };

/**
 * SCRUM-207 AC5 — runs the confirmed action. Success closes the dialog; a
 * refusal keeps it open with the action's own message, so the user can read
 * it and choose again.
 */
export async function runConfirmed(
  action: () => Promise<ConfirmOutcome>,
  on: { close: () => void; fail: (error: string) => void },
): Promise<void> {
  const result = await action();
  if (result.ok) on.close();
  else on.fail(result.error);
}

type Wording = {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  /** Shown on the confirm button while the action runs, e.g. "Withdrawing…". */
  pendingLabel: string;
  cancelLabel?: string;
  /** The action can't be undone and takes something away: a red button. */
  destructive?: boolean;
};

/** The dialog's contents, separate so they render without a browser. */
export function ConfirmDialogBody({
  title,
  message,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Cancel",
  destructive = false,
  pending,
  error,
  onConfirm,
  onCancel,
}: Wording & {
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{message}</DialogDescription>
      </DialogHeader>
      {error && (
        <p
          role="alert"
          className="text-sm text-destructive"
          data-testid="confirm-dialog-error"
        >
          {error}
        </p>
      )}
      <DialogFooter>
        <Button
          variant="outline"
          disabled={pending}
          onClick={onCancel}
          className="h-11 sm:h-10"
          data-testid="confirm-dialog-cancel"
        >
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? "destructive" : "default"}
          disabled={pending}
          onClick={onConfirm}
          className="h-11 sm:h-10"
          data-testid="confirm-dialog-confirm"
        >
          {pending ? pendingLabel : confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * SCRUM-207 AC5 — the one dialog every action that can't be undone asks in.
 * `trigger` opens it; nothing happens until the user confirms, and the way
 * back changes nothing.
 */
export function ConfirmDialog({
  trigger,
  onConfirm,
  testId,
  ...wording
}: Wording & {
  trigger: React.ReactNode;
  onConfirm: () => Promise<ConfirmOutcome>;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    // The action is already on its way; closing now would hide its outcome.
    if (pending) return;
    setOpen(next);
    setError(null);
  }

  function confirm() {
    setError(null);
    startTransition(() =>
      runConfirmed(onConfirm, { close: () => setOpen(false), fail: setError }),
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent hideClose className="max-w-md" data-testid={testId}>
        <ConfirmDialogBody
          {...wording}
          pending={pending}
          error={error}
          onConfirm={confirm}
          onCancel={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
