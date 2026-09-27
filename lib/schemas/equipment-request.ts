import { z } from "zod";

const QUANTITY_MESSAGE = "Quantity must be a positive whole number.";

/**
 * A blank optional text field is stored as no value, not as "". Null is
 * accepted too, because the form checks lines it has already parsed.
 */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullish()
    .transform((value) => value || null);

/**
 * SCRUM-27 — one equipment line: a type from the predefined list (AC 2), a
 * positive whole quantity (AC 3) and free-text technical requirements (AC 5).
 * The 1,000 ceiling keeps a mistyped quantity out of the Int column.
 */
export const equipmentRequestLineSchema = z.object({
  equipmentId: z.string().min(1, "Select an equipment type."),
  quantity: z.coerce
    .number({ invalid_type_error: QUANTITY_MESSAGE })
    .int(QUANTITY_MESSAGE)
    .positive(QUANTITY_MESSAGE)
    .max(1000, "Quantity can be at most 1,000."),
  technicalRequirements: optionalText(
    1000,
    "Keep technical requirements under 1,000 characters.",
  ),
});

/**
 * SCRUM-27 — the request as submitted. AC 4 is checked here as well as by the
 * database's unique (requestId, equipmentId) index, so the form can say which
 * line repeats a type instead of the insert failing.
 */
export const createEquipmentRequestSchema = z
  .object({
    eventId: z.string().min(1, "Select an event."),
    notes: optionalText(2000, "Keep notes under 2,000 characters."),
    lines: z
      .array(equipmentRequestLineSchema)
      .min(1, "Add at least one equipment item.")
      .max(20, "A request can list at most 20 equipment types."),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    data.lines.forEach((line, index) => {
      if (seen.has(line.equipmentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lines", index, "equipmentId"],
          message: "This equipment type is already on the request.",
        });
      }
      seen.add(line.equipmentId);
    });
  });

/**
 * SCRUM-28 AC 2 — Technical Support moves a request on. A rejection must say
 * why: the coordinator is the one who has to act on it.
 */
export const reviewEquipmentRequestSchema = z
  .object({
    requestId: z.string().min(1),
    toStatus: z.enum(["IN_REVIEW", "APPROVED", "REJECTED"]),
    note: optionalText(1000, "Keep the note under 1,000 characters."),
  })
  .superRefine((data, ctx) => {
    if (data.toStatus === "REJECTED" && !data.note) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["note"],
        message: "Give the coordinator a reason for rejecting the request.",
      });
    }
  });

/** SCRUM-28 AC 3 — suggest another type for one line of a request. */
export const suggestAlternativeSchema = z.object({
  requestId: z.string().min(1),
  lineId: z.string().min(1),
  alternativeId: z.string().min(1, "Choose the equipment to suggest."),
});

/**
 * Zod's `flatten()` keeps only the top-level key, so every line's error would
 * collapse into "lines". Keying by the full path ("lines.1.quantity") lets the
 * form put each message on the line it belongs to.
 */
export function fieldErrorsByPath(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}
