/**
 * A section's list that is empty, or not read yet: says it is loading, or
 * that it couldn't be read, rather than that nothing was requested.
 */
export function ListState({
  state,
  what,
  children,
}: {
  state: "loading" | "ready" | "failed";
  what: string;
  children: React.ReactNode;
}) {
  if (state === "loading") {
    return (
      <p role="status" className="text-muted-foreground">
        Loading…
      </p>
    );
  }
  if (state === "failed") {
    return (
      <p
        role="alert"
        className="text-muted-foreground"
        data-testid="list-failed"
      >
        Couldn&apos;t load the {what}.
      </p>
    );
  }
  return <p className="text-muted-foreground">{children}</p>;
}
