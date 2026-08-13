/**
 * Shared number formatting for the free indication's result page. Same
 * conventions as app/rapport/resultaat/_lib/format.ts (UI_SPEC.md §1:
 * "geen schijnprecisie"), duplicated locally rather than imported - this
 * route is a deliberately separate flow from the paid report.
 */

const EURO = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Whole euros - the report's default, per UI_SPEC.md §1. */
export function formatEuro(value: number): string {
  return EURO.format(value);
}
