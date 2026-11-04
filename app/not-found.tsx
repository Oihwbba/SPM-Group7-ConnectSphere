import { NotFoundMessage } from "@/components/app/not-found-message";

/** An address that matches no page at all (SCRUM-207). */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <NotFoundMessage />
    </main>
  );
}
