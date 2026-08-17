/**
 * Local formatting for the search results - same duplication as every
 * other route family's own _lib/format.ts (app/gratis/resultaat,
 * app/rapport/resultaat). Only what a listing card needs: whole euros
 * and the property-type labels the wizard's own PandForm already uses
 * (duplicated the same way indicatie-result.tsx duplicates them, not
 * imported from a private wizard folder).
 */

const EURO = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatEuro(value: number): string {
  return EURO.format(value);
}

export const PROPERTY_TYPE_LABEL_NL: Readonly<Record<string, string>> = {
  appartement: "Appartement",
  studio: "Studio",
  penthouse: "Penthouse",
  woonhuis: "Woonhuis",
  villa: "Villa",
  anders: "Anders",
};
