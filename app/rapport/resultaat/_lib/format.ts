/**
 * Shared number formatting for the report sections. Centralised so every
 * section renders €, % and the 0–10 score the same way - UI_SPEC.md §1's
 * "geen schijnprecisie" is a rule about the whole report, not one section.
 */

const EURO = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const EURO_PRECISE = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PERCENT = new Intl.NumberFormat("nl-NL", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Whole euros - the report's default, per UI_SPEC.md §1. */
export function formatEuro(value: number): string {
  return EURO.format(value);
}

/** Two decimals - only for rates (€/m²) where the cents are the point. */
export function formatEuroPrecise(value: number): string {
  return EURO_PRECISE.format(value);
}

export function formatPercent(fraction: number): string {
  return PERCENT.format(fraction);
}

/** A 0–10 score at the one decimal SCORE_SPEC.md §1 defines it to carry. */
export function formatScore(value: number): string {
  return value.toFixed(1).replace(".", ",");
}
