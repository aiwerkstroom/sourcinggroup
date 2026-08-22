/**
 * Dutch labels for the calculation layer's own enumerations (UI_SPEC.md:
 * Nederlands in de UI; CLAUDE.md §6: Engels in de code en commentaar).
 *
 * Same split as the disclosure and validation copy: the model speaks
 * "good"/"average"/"poor", this module is the only place those become
 * words a customer reads. Records typed over the union so a value added
 * to MaintenanceCondition (or RentalStrategy) without a label here fails
 * to compile.
 */

import type { FreeTierRentLevel, MaintenanceCondition, RentalStrategy } from "../../rules/es/types";

/**
 * "Staat van onderhoud" (UI_SPEC.md §3). The wording is deliberately
 * about observable condition, not about renovation work: the customer
 * assesses the property, and RENOVATION_TIER_BY_MAINTENANCE_CONDITION -
 * a PLACEHOLDER, i.e. an unverified claim - is what turns that into a
 * renovation tier. Asking "hoeveel renovatie is nodig?" would put that
 * unverified step in the customer's mouth.
 */
export const MAINTENANCE_CONDITION_COPY_NL: Readonly<
  Record<MaintenanceCondition, { label: string; description: string }>
> = {
  good: {
    label: "Goed onderhouden",
    description: "Recent gerenoveerd of instapklaar. Geen bekende gebreken.",
  },
  average: {
    label: "Redelijke staat",
    description: "Normale gebruikssporen. Bewoonbaar, maar gedateerd op onderdelen.",
  },
  poor: {
    label: "Achterstallig onderhoud",
    description: "Opknapper. Installaties, sanitair of afwerking vragen aandacht.",
  },
};

export const MAINTENANCE_CONDITION_ORDER: readonly MaintenanceCondition[] = [
  "good",
  "average",
  "poor",
];

/** Verhuurstrategie (used by step 3; the permit gate decides which are offered). */
export const RENTAL_STRATEGY_COPY_NL: Readonly<Record<RentalStrategy, string>> = {
  longTerm: "Langetermijnverhuur",
  shortTerm: "Kortetermijnverhuur",
  hybrid: "Hybride (combinatie)",
};

/**
 * "Hoe verhoudt de huur zich tot het wijkgemiddelde?" (fase A stap 1, gratis
 * indicatie). A qualitative choice rather than an exact €/m² figure -
 * FreeTierBandInput.rentLevel narrows FREE_TIER_BAND_RENT_MARGIN's ±8%
 * split to a single direction, so a direction is all the customer needs to
 * supply, not a number they may not know precisely.
 */
export const FREE_TIER_RENT_LEVEL_COPY_NL: Readonly<Record<FreeTierRentLevel, string>> = {
  below: "Onder het wijkgemiddelde",
  average: "Rond het wijkgemiddelde",
  above: "Boven het wijkgemiddelde",
};

export const FREE_TIER_RENT_LEVEL_ORDER: readonly FreeTierRentLevel[] = [
  "below",
  "average",
  "above",
];
