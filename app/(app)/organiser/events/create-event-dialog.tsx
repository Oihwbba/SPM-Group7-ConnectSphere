"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createDraftEvent } from "./actions";

/**
 * Create-a-draft form. It calls the Server Action directly (no react-hook-form)
 * and maps the returned ActionResult to either a success toast or inline field
 * errors. This is the client half of the §6 convention — copy this shape when
 * your feature needs a create/edit form.
 */
export function CreateEventDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Capture the form element now — it's still valid inside the async
    // callback because we hold a direct reference, not the pooled event.
    const form = event.currentTarget;
    const formData = new FormData(form);
    const input = {
      name: String(formData.get("name") ?? ""),
      // Send undefined (not "") for an empty description so it stays optional.
      description: String(formData.get("description") ?? "") || undefined,
    };

    startTransition(async () => {
      const result = await createDraftEvent(input);

      if (result.ok) {
        toast.success("Draft event created.");
        setFieldErrors({});
        form.reset();
        setOpen(false);
        return;
      }

      setFieldErrors(result.fieldErrors ?? {});
      toast.error(result.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          New draft
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New draft event</DialogTitle>
            <DialogDescription>
              Start with a name and an optional description. You can fill in the
              rest before submitting for review.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Event name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Annual Tech Summit"
                aria-invalid={!!fieldErrors.name}
                required
              />
              {fieldErrors.name?.map((message) => (
                <p key={message} className="text-sm text-destructive">
                  {message}
                </p>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="What is this event about?"
                rows={4}
                aria-invalid={!!fieldErrors.description}
              />
              {fieldErrors.description?.map((message) => (
                <p key={message} className="text-sm text-destructive">
                  {message}
                </p>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
