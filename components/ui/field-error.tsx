/** A field's first validation message, announced and tied to its input by `id`. */
export function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.[0]) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {messages[0]}
    </p>
  );
}
