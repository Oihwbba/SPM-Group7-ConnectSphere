"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCircleQuestion } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getClarificationForEvent,
  respondToClarification,
} from "@/app/(app)/events/clarification-actions";

interface ClarificationPanelProps {
  eventId: string;
  /** True when the viewer is the Coordinator (read-only here); false means
   * the viewer is the Organiser, who can respond while a request is OPEN. */
  isCoordinator: boolean;
}

type Clarification = {
  id: string;
  message: string;
  status: string;
  response: string | null;
  createdAt: string | Date;
  respondedAt: string | Date | null;
};

/**
 * SCRUM-18 — shown inside the event details modal for both roles. A
 * Coordinator sees their question and, once answered, the Organiser's reply.
 * An Organiser sees the question and, while it's OPEN, a box to reply.
 *
 * Renders nothing when there is no clarification thread on this event, so it
 * adds no visual noise to events that were never questioned.
 */
export function ClarificationPanel({
  eventId,
  isCoordinator,
}: ClarificationPanelProps) {
  const [clarification, setClarification] = useState<Clarification | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    getClarificationForEvent(eventId).then((result) => {
      if (cancelled) return;
      if (result.ok) setClarification(result.data.clarification);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  async function submitResponse() {
    if (!clarification || !response.trim()) return;
    setSubmitting(true);
    const result = await respondToClarification({
      clarificationId: clarification.id,
      response,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Response sent to the coordinator.");
    setClarification({
      ...clarification,
      status: "ANSWERED",
      response,
      respondedAt: new Date(),
    });
    router.refresh();
  }

  if (loading || !clarification) return null;

  const isOpen = clarification.status === "OPEN";

  return (
    <Card>
      <CardHeader className="bg-amber-50 px-4 py-3 dark:bg-amber-950/20">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <MessageCircleQuestion className="h-4 w-4 text-amber-600 dark:text-amber-500" />
          Clarification {isOpen ? "requested" : "thread"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 text-xs">
        <div>
          <span className="font-semibold text-muted-foreground">
            Coordinator asked:
          </span>
          <p className="mt-0.5 whitespace-pre-wrap text-foreground">
            {clarification.message}
          </p>
        </div>

        {clarification.status === "ANSWERED" && (
          <div>
            <span className="font-semibold text-muted-foreground">
              Organiser responded:
            </span>
            <p className="mt-0.5 whitespace-pre-wrap text-foreground">
              {clarification.response}
            </p>
          </div>
        )}

        {isOpen && isCoordinator && (
          <p className="text-muted-foreground">
            Waiting for the organiser&apos;s response.
          </p>
        )}

        {isOpen && !isCoordinator && (
          <div className="space-y-2 pt-1">
            <Textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Type your response…"
              aria-label="Response to clarification"
            />
            <Button
              size="sm"
              disabled={submitting || !response.trim()}
              onClick={submitResponse}
            >
              Send response
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}