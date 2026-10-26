"use client";

import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * The pop-up that confirms a form went through (shared page conventions,
 * change 8): an animated tick, what happened, a way to close it, and
 * optionally a way to see what was sent.
 */
export function SubmittedDialog({
  open,
  title,
  children,
  onClose,
  closeLabel = "Done",
  action,
  testId,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  closeLabel?: string;
  /** A second button, e.g. "View Details". */
  action?: { label: string; onClick: () => void };
  testId?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        hideClose
        data-testid={testId}
        className="max-w-sm text-center sm:text-center"
      >
        <div className="relative mx-auto mt-2 flex h-20 w-20 items-center justify-center">
          <span className="absolute h-20 w-20 animate-ping rounded-full bg-success/20 [animation-iteration-count:2]" />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-success text-success-foreground shadow-lg duration-500 animate-in zoom-in-50">
            <Check
              className="h-10 w-10 delay-200 duration-500 animate-in fade-in-0 zoom-in-0 fill-mode-both"
              strokeWidth={3}
            />
          </span>
        </div>
        <DialogTitle className="text-xl">{title}</DialogTitle>
        <DialogDescription>{children}</DialogDescription>
        <DialogFooter className="gap-2 sm:justify-center">
          <Button
            variant={action ? "outline" : "default"}
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            {closeLabel}
          </Button>
          {action && (
            <Button onClick={action.onClick} className="w-full sm:w-auto">
              {action.label}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
