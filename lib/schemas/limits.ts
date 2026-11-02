/**
 * SCRUM-259 — the most entries any list in a request may hold. Zod reads every
 * entry of an uncapped array and keeps an issue for each one that fails, so a
 * large request can exhaust memory (GHSA-mrhx-c7xc-m3w5). A capped array is
 * refused on its length, before its entries are read.
 */
export const MAX_LIST_ITEMS = 500;
