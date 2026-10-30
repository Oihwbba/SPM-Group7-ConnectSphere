/**
 * The shared look of a decision button: positive, middle or negative. They
 * sit side by side in one row (DECISION_ROW), sharing its width; a long label
 * wraps inside its button on a phone rather than pushing the row wider.
 */
const SHARED =
  "h-auto min-h-10 min-w-0 flex-1 whitespace-normal px-2 py-2 sm:px-4";

export const DECISION_BUTTON = {
  positive: `${SHARED} border-success/50 bg-success/10 text-success hover:bg-success/20 hover:text-success`,
  middle: SHARED,
  negative: `${SHARED} border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive`,
} as const;

/** The row the decision buttons share, in every queue. */
export const DECISION_ROW = "flex gap-2";

/** A decision panel: its heading and controls, with no card behind them. */
export const DECISION_PANEL = "space-y-3";
