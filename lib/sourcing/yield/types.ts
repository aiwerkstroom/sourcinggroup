/**
 * Types for the sourcing sieve's yield (SOURCING_SPEC.md §7 step 2,
 * design approved by Samuel).
 *
 * Own module, own types - not an addition to lib/rules/es/types.ts. The
 * design's own first line is the reason: this never touches runEngine(),
 * the same structural separation the free-tier band already keeps for
 * the same reason (CLAUDE.md §6 - a value the customer/listing has not
 * supplied is a reason to write a smaller function, never a reason to
 * feed the main engine an assumption).
 */

import type { Parameter } from "@/lib/rules/es/types";

/**
 * The four disclosures the design fixed, mirroring
 * FreeTierDisclosureKey's own key-plus-copy split (CLAUDE.md §6: Engels
 * hier, Nederlands in lib/copy/es/sourcing-yield-disclosures.ts). All
 * four apply unconditionally to every SieveYieldResult - none is
 * specific to a listing, so SIEVE_YIELD_DISCLOSURE_KEYS below is a
 * constant, not something computeSieveYield derives per call.
 *
 * - `grossOnly`: no cost is subtracted - not management, not
 *   maintenance, not IBI. That is what "bruto" means, not an
 *   approximation of a net figure.
 * - `longTermOnly`: always the long-term reference rent, regardless of
 *   what a listing's own tourist-licence status might be - a listing
 *   never carries that data at all (SOURCING_SPEC.md §1's minimal
 *   Listing shape has no such field), so short-term is not an option
 *   here the way it briefly is in the wizard.
 * - `neighborhoodAverage`: the wijk's average rent, not this specific
 *   property's achievable rent. Two identical-looking flats a street
 *   apart can differ.
 * - `notTheReport`: this is a sieve threshold, not the paid report's
 *   IRR/cashflow. The two must never be read as the same measurement.
 */
export type SourcingYieldDisclosureKey =
  | "grossOnly"
  | "longTermOnly"
  | "neighborhoodAverage"
  | "notTheReport";

/**
 * Every SourcingYieldDisclosureKey, as a runtime list - same
 * exhaustiveness trick as ALL_FREE_TIER_DISCLOSURE_KEYS
 * (lib/rules/es/types.ts): a key added to the union without a matching
 * entry here fails to compile, so this can be trusted as the complete
 * set rather than a hand-maintained copy that silently falls behind.
 */
const SOURCING_YIELD_DISCLOSURE_KEY_SET: Readonly<Record<SourcingYieldDisclosureKey, true>> = {
  grossOnly: true,
  longTermOnly: true,
  neighborhoodAverage: true,
  notTheReport: true,
};

export const ALL_SOURCING_YIELD_DISCLOSURE_KEYS: readonly SourcingYieldDisclosureKey[] =
  Object.keys(SOURCING_YIELD_DISCLOSURE_KEY_SET) as SourcingYieldDisclosureKey[];

/**
 * The sieve's result for one listing. `sieveYieldPercent` is the only
 * field a page shows next to a listing - rounded to a whole percentage
 * point already (the design's precision guard), so nothing downstream
 * can accidentally re-derive a falsely precise decimal from it.
 *
 * `placeholdersUsed` mirrors FreeTierBand's own field of the same name:
 * empty when the listing gave its own usableAreaM2 (nothing but the
 * SOURCED rent table went into the number), or
 * [DEFAULT_USABLE_TO_BUILT_AREA_RATIO] when the area had to be derived.
 * Tracking this costs nothing and is the same "herkomst zichtbaar"
 * discipline every other calculation path in this project already
 * follows.
 */
export interface SieveYieldResult {
  listingSourceId: string;
  neighborhood: string;
  /** NEIGHBORHOOD_RENT_LONG_TERM's value for this wijk - SOURCED, unchanged from the wizard's own table. */
  referenceRentPerM2: number;
  usableAreaM2: number;
  annualGrossRent: number;
  /** Already rounded to a whole percentage point - see the module docstring. */
  sieveYieldPercent: number;
  placeholdersUsed: Parameter<unknown>[];
  /** Always all four of ALL_SOURCING_YIELD_DISCLOSURE_KEYS - ships on the result so a page can never render the figure without resolving them. */
  disclosures: readonly SourcingYieldDisclosureKey[];
}
