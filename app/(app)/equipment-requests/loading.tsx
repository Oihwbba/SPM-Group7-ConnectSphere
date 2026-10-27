import { QueueLoading } from "@/components/queues/queue-loading";

/** Streamed while the server component loads equipment requests (SCRUM-27/28). */
export default function Loading() {
  return <QueueLoading label="Loading equipment requests" />;
}
