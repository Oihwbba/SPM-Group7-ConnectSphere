"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, NotebookPen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/datetime";
import {
  addOperationalNote,
  getOperationalNotes,
  type OperationalNoteView,
} from "@/app/(app)/events/edit-actions";

/**
 * SCRUM-25 AC6 — an event's operational notes: each with its author and time,
 * never edited or removed. The server decides who may read them and who may
 * add one; a user who may neither sees nothing here.
 */
export function OperationalNotes({ eventId }: { eventId: string }) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "hidden" }
    | { kind: "error" }
    | { kind: "ready"; notes: OperationalNoteView[]; canAdd: boolean }
  >({ kind: "loading" });
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputId = useId();
  // Bumped after a note is added, to read the list again.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getOperationalNotes(eventId)
      .then((result) => {
        if (cancelled) return;
        setState(
          result.ok ? { kind: "ready", ...result.data } : { kind: "hidden" },
        );
      })
      .catch(() => !cancelled && setState({ kind: "error" }));
    return () => {
      cancelled = true;
    };
  }, [eventId, version]);

  if (state.kind === "hidden") return null;

  function add() {
    startTransition(async () => {
      const result = await addOperationalNote({ eventId, body });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      setError(null);
      toast.success("Note added.");
      setVersion((v) => v + 1);
    });
  }

  return (
    <Card className="overflow-hidden" data-testid="operational-notes">
      <CardHeader className="bg-muted/30 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <NotebookPen className="h-4 w-4 text-primary" /> Operational notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 text-xs">
        {state.kind === "loading" && (
          <p className="text-muted-foreground">Loading notes…</p>
        )}
        {state.kind === "error" && (
          <p role="alert" className="text-destructive">
            The notes could not be loaded. Try again shortly.
          </p>
        )}
        {state.kind === "ready" && (
          <>
            {state.notes.length === 0 ? (
              <p className="text-muted-foreground">No notes yet.</p>
            ) : (
              <ul className="space-y-2">
                {state.notes.map((note) => (
                  <li
                    key={note.id}
                    data-testid="operational-note"
                    className="rounded-md border p-2"
                  >
                    <p className="whitespace-pre-wrap text-foreground">{note.body}</p>
                    <p className="mt-1 text-muted-foreground">
                      {note.authorName}, {formatDateTime(note.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {state.canAdd && (
              <div className="space-y-2 border-t pt-3">
                <Label htmlFor={inputId}>Add a note</Label>
                <Textarea
                  id={inputId}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="e.g. Stage riser delivered and checked"
                />
                {error && (
                  <p role="alert" className="text-destructive">
                    {error}
                  </p>
                )}
                <Button size="sm" onClick={add} disabled={isPending}>
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add note
                </Button>
                <p className="text-muted-foreground">
                  Notes can&apos;t be edited or removed once added.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
