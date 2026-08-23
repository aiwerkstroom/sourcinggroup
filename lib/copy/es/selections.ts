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

import type {
  FreeTierRentLevel,
  MaintenanceCondition,
  RentalStrategy,
  RenovationStrategyId,
} from "../../rules/es/types";

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

/**
 * Renovatiescenario, as an explicit override of the derivation above (fase
 * C stap 1).
 *
 * This qualifies MAINTENANCE_CONDITION_COPY_NL's own reasoning rather than
 * contradicting it. That note argues against *asking* "hoeveel renovatie
 * is nodig?", because it would put RENOVATION_TIER_BY_MAINTENANCE_CONDITION's
 * unverified step into the customer's mouth - and that still holds for the
 * default path, which is why deriving remains the default option and the
 * condition question keeps its own wording. What changed is that a
 * customer who has had a contractor walk through the property knows the
 * answer better than a PLACEHOLDER lookup does, and had no way to say so.
 * The override is opt-in, never preselected, and always recorded as
 * "customerChosen" against the derived value (RenovationTierProvenance),
 * so a tier that came from the customer is never presented as if the model
 * concluded it.
 *
 * Descriptions name the scope of work, not a euro figure: the per-tier
 * capex in RENOVATION_STRATEGIES is itself PLACEHOLDER, so quoting it here
 * as if it were a quote would be a stronger claim than the model can make.
 */
export const RENOVATION_STRATEGY_CHOICE_COPY_NL: Readonly<
  Record<RenovationStrategyId, { label: string; description: string }>
> = {
  minimal: {
    label: "Minimaal",
    description: "Schilderwerk en kleine herstelwerkzaamheden. Het pand is in de kern in orde.",
  },
  light: {
    label: "Licht",
    description: "Keuken, badkamer of afwerking aanpakken. Installaties blijven grotendeels intact.",
  },
  heavy: {
    label: "Grondig",
    description: "Installaties, indeling of casco aanpakken. Een ingrijpende verbouwing.",
  },
};

export const RENOVATION_STRATEGY_ORDER: readonly RenovationStrategyId[] = [
  "minimal",
  "light",
  "heavy",
];

/** The wizard's "derive it for me" sentinel - "" in StaatEnLastenStepData.renovationStrategyOverride. */
export const RENOVATION_STRATEGY_DERIVED_OPTION_VALUE = "";

/**
 * Label for the derive-it-for-me option, naming the tier the derivation
 * currently lands on so the customer sees what they are accepting before
 * deciding whether to override it.
 */
export function renovationStrategyDerivedOptionLabel(
  derived: RenovationStrategyId | null,
): string {
  if (derived === null) return "Afgeleid uit de staat van onderhoud";
  return `Afgeleid uit de staat van onderhoud (${RENOVATION_STRATEGY_CHOICE_COPY_NL[derived].label})`;
}

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
