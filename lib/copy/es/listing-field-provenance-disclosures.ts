/**
 * Dutch copy for the paid report's listing-field-provenance disclosures
 * (SOURCING_SPEC.md §4/§7 step 4, stap 3 van 3). Same split as every
 * other copy-layer module: lib/rules/es/types.ts defines
 * ListingFieldProvenanceReport, this file is the only place its
 * "fromListing" status becomes a sentence.
 *
 * Two treatments, per the approved design:
 *
 * - purchasePrice gets §6.1's boxed notice, the same visual weight as a
 *   significant rent override (one-line-outcome-section.tsx) - an
 *   unverified purchase price drives the headline figures just as
 *   directly as an unverified rent does.
 * - neighborhood/builtAreaM2/usableAreaM2 share one quiet §6.8 line,
 *   naming whichever of the three are still unconfirmed - no box, no
 *   colour, the same register as the assumptions list's own faint notes.
 *
 * A field with status "confirmed" - the customer edited it, or it never
 * came from a listing at all (report is EMPTY_LISTING_FIELD_PROVENANCE) -
 * says nothing in either place. propertyType has no entry here because it
 * has no key in ListingFieldProvenanceReport at all: it carries no
 * outcome, so it was never tracked past the wizard's own prefill.
 */

import type { ListingFieldProvenanceReport } from "@/lib/rules/es/types";

const EURO = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function formatEuro(value: number): string {
  return EURO.format(value);
}

export type ListingFieldProvenanceDisclosureField = "neighborhood" | "builtAreaM2" | "usableAreaM2";

const LISTING_FIELD_LABEL_NL: Readonly<Record<ListingFieldProvenanceDisclosureField, string>> = {
  neighborhood: "de wijk",
  builtAreaM2: "het gebouwd oppervlak",
  usableAreaM2: "het bruikbaar oppervlak",
};

/** A switch on top of the Record above - same double-check every other disclosure module in this project uses. */
function listingFieldLabel(field: ListingFieldProvenanceDisclosureField): string {
  switch (field) {
    case "neighborhood":
      return LISTING_FIELD_LABEL_NL.neighborhood;
    case "builtAreaM2":
      return LISTING_FIELD_LABEL_NL.builtAreaM2;
    case "usableAreaM2":
      return LISTING_FIELD_LABEL_NL.usableAreaM2;
    default: {
      const exhaustive: never = field;
      throw new Error(`Missing Dutch copy for listing field: ${String(exhaustive)}`);
    }
  }
}

/** Caller guarantees at least one item - see the length check before every call site. */
function joinDutch(items: readonly string[]): string {
  const last = items[items.length - 1]!;
  if (items.length === 1) return last;
  return `${items.slice(0, -1).join(", ")} en ${last}`;
}

/**
 * §6.1's boxed notice for an unconfirmed listing price. Returns null when
 * there is nothing to say: no listing origin at all (originalValue never
 * set, so the field is null) or the customer has already confirmed/edited
 * the price (status "confirmed").
 */
export function translatePurchasePriceFromListingNotice(
  purchasePrice: ListingFieldProvenanceReport["purchasePrice"],
): string | null {
  if (purchasePrice === null || purchasePrice.status !== "fromListing") return null;
  return (
    `Deze aankoopprijs (${formatEuro(purchasePrice.originalValue)}) is overgenomen uit de ` +
    `gekozen listing en nog niet door u bevestigd. Controleer of dit bedrag nog actueel is ` +
    `voordat u op deze uitkomst vertrouwt.`
  );
}

/**
 * §6.8's quiet line for wijk/oppervlak still carrying a listing's own
 * values - never purchasePrice, which has its own §6.1 treatment above.
 * Returns null once every one of the three fields is confirmed or there
 * was no listing origin at all.
 */
export function translateListingFieldsFromListingNote(
  report: ListingFieldProvenanceReport,
): string | null {
  const fields: ListingFieldProvenanceDisclosureField[] = [];
  if (report.neighborhood?.status === "fromListing") fields.push("neighborhood");
  if (report.builtAreaM2?.status === "fromListing") fields.push("builtAreaM2");
  if (report.usableAreaM2?.status === "fromListing") fields.push("usableAreaM2");
  if (fields.length === 0) return null;

  const joined = joinDutch(fields.map(listingFieldLabel));
  const capitalized = joined.charAt(0).toUpperCase() + joined.slice(1);
  const verb = fields.length === 1 ? "is" : "zijn";
  return `${capitalized} ${verb} overgenomen uit de gekozen listing, niet door u bevestigd.`;
}
