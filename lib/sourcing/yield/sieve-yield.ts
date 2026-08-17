/**
 * The sourcing sieve's yield (SOURCING_SPEC.md §7 step 2). Design
 * approved by Samuel: wijkhuur (SOURCED) x bruikbaar_m² x 12 /
 * listing.priceEUR, rounded to a whole percentage point, no occupancy
 * discount, always long-term.
 *
 * This is a deliberately separate, simpler calculation path - not
 * runEngine() fed a listing's four known fields. The free-tier band
 * (lib/rules/es/free-tier/band.ts) already set this precedent for the
 * exact same reason: a listing has no financing, no exit assumptions, no
 * gastos de comunidad, no staat van onderhoud - there is nothing to run
 * the main engine on. What the two paths share is only the discipline,
 * not any code: this module never imports runEngine or anything from
 * lib/rules/es/engine.ts.
 *
 * "Bruto" is not this module's approximation of a net figure - it is the
 * standard definition of "bruto aanvangsrendement" in Spanish/Dutch
 * real-estate practice: annual rent over purchase price, with no cost
 * deduction and no vacancy discount. That is also, not coincidentally,
 * the only yield a listing's four fields (price, wijk, oppervlak, type)
 * can support without inventing data the bron never gave.
 */

import {
  DEFAULT_USABLE_TO_BUILT_AREA_RATIO,
  NEIGHBORHOOD_RENT_LONG_TERM,
} from "@/lib/rules/es/parameters";
import type { Parameter } from "@/lib/rules/es/types";
import type { Listing } from "../source/types";
import { ALL_SOURCING_YIELD_DISCLOSURE_KEYS } from "./types";
import type { SieveYieldResult } from "./types";

const MONTHS_PER_YEAR = 12;

/**
 * Throws on an unknown wijk rather than falling back to a city average -
 * same choice computeFreeTierBand makes, for the same reason: the
 * neighbourhood is the single largest driver of the rent estimate, and a
 * silent fallback would let a badly-matched listing pass or fail the
 * sieve on a number nobody chose. Every listing this module has actually
 * seen (source-mock.ts, and later a real adapter constrained to
 * VALENCIA_NEIGHBORHOODS) has a wijk from the known 13; a listing outside
 * that set is a bug upstream; not this function's job to paper over.
 */
export function computeSieveYield(listing: Listing): SieveYieldResult {
  const referenceRentPerM2 = NEIGHBORHOOD_RENT_LONG_TERM.value[listing.neighborhood];
  if (referenceRentPerM2 === undefined) {
    throw new Error(
      `No long-term reference rent for neighbourhood "${listing.neighborhood}". ` +
        `Known: ${Object.keys(NEIGHBORHOOD_RENT_LONG_TERM.value).join(", ")}`,
    );
  }

  // MODEL_SPEC.md §17: rent is earned on usable area, same as the wizard
  // and the free-tier band. A listing's own usableAreaM2, when the bron
  // gives one, is brondata rather than an assumption - it just is not
  // yet customer-confirmed (SOURCING_SPEC.md §4, a later step's
  // question, not this one's).
  const usableAreaGiven = listing.usableAreaM2 !== undefined;
  const usableAreaM2 = usableAreaGiven
    ? listing.usableAreaM2!
    : listing.builtAreaM2 * DEFAULT_USABLE_TO_BUILT_AREA_RATIO.value;

  const annualGrossRent = referenceRentPerM2 * usableAreaM2 * MONTHS_PER_YEAR;
  const rawFraction = annualGrossRent / listing.priceEUR;
  const sieveYieldPercent = Math.round(rawFraction * 100);

  const placeholdersUsed: Parameter<unknown>[] = usableAreaGiven
    ? []
    : [DEFAULT_USABLE_TO_BUILT_AREA_RATIO];

  return {
    listingSourceId: listing.sourceId,
    neighborhood: listing.neighborhood,
    referenceRentPerM2,
    usableAreaM2,
    annualGrossRent,
    sieveYieldPercent,
    placeholdersUsed,
    disclosures: ALL_SOURCING_YIELD_DISCLOSURE_KEYS,
  };
}
