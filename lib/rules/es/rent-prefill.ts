/**
 * Which rent rate the paid form's step 3 starts from, and where it came
 * from (interview round 2: "voorinvullen, overschrijven mag").
 *
 * Three sources, in priority order per rate:
 *
 *   1. The rent this property is actually being let at today, converted
 *      to €/m²/month. Strongest evidence available - it is this building,
 *      not a wijk average - so it wins where it exists.
 *   2. The neighbourhood reference (NEIGHBORHOOD_RENT_LONG_TERM /
 *      _SHORT_TERM), SOURCED market data.
 *   3. Nothing. The paid path accepts any address, so a property outside
 *      the 13 covered wijken has no reference to start from and the
 *      customer supplies the figure themselves.
 *
 * On the conversion, which is the one place this could quietly go wrong:
 * the observed monthly rent is divided by usable area and nothing else.
 * It is deliberately NOT grossed up for vacancy. A let property's rent is
 * its *contract* rate - what it earns in a month it is occupied - and
 * that is exactly the quantity income.ts multiplies by
 * BASE_OCCUPANCY_LONG_TERM to allow for future vacancy. Grossing up here
 * would cancel that allowance and quietly assume this property never
 * stands empty again.
 *
 * The renovation rentMultiplier still applies on top, as it does to a
 * reference rate: the model's convention is that renovation changes what
 * a property can command, and an observed rent is a pre-renovation
 * observation like any other.
 *
 * Server-side only in practice (it reads parameters.ts), which is why
 * step 3 reaches it through a Server Action rather than importing it into
 * the browser - interview round 1's server-side decision.
 */

import {
  DEFAULT_USABLE_TO_BUILT_AREA_RATIO,
  NEIGHBORHOOD_RENT_LONG_TERM,
  NEIGHBORHOOD_RENT_SHORT_TERM,
} from "./parameters";

export type RentPrefillSource = "actualCurrentRent" | "neighborhoodReference" | "none";

export interface RentPrefillRate {
  /** €/m²/month, or null when no source could supply one. */
  rentPerM2: number | null;
  source: RentPrefillSource;
}

export interface RentPrefill {
  longTerm: RentPrefillRate;
  shortTerm: RentPrefillRate;
  /**
   * The usable area the conversion used - measured when the customer gave
   * one, otherwise derived from the built area via the PLACEHOLDER ratio
   * (MODEL_SPEC.md §17). Reported so the form can say which it was.
   */
  usableAreaM2: number;
  usableAreaWasDerived: boolean;
}

export function computeRentPrefill(args: {
  neighborhood: string | undefined;
  builtAreaM2: number;
  /** PropertyInput.usableAreaM2 when measured; omitted otherwise. */
  usableAreaM2?: number;
  /** € per month for the whole property, as currently let. Omitted when vacant or unknown. */
  actualCurrentRentMonthly?: number;
  /** Which rate the observed rent informs, derived from the letting status in step 2. */
  actualCurrentRentAppliesTo?: "longTerm" | "shortTerm";
}): RentPrefill {
  const usableAreaWasDerived = args.usableAreaM2 === undefined;
  const usableAreaM2 =
    args.usableAreaM2 ?? args.builtAreaM2 * DEFAULT_USABLE_TO_BUILT_AREA_RATIO.value;

  const observedRentPerM2 =
    args.actualCurrentRentMonthly !== undefined &&
    args.actualCurrentRentMonthly > 0 &&
    usableAreaM2 > 0
      ? args.actualCurrentRentMonthly / usableAreaM2
      : null;

  function rateFor(
    rate: "longTerm" | "shortTerm",
    table: Readonly<Record<string, number>>,
  ): RentPrefillRate {
    if (observedRentPerM2 !== null && args.actualCurrentRentAppliesTo === rate) {
      return { rentPerM2: observedRentPerM2, source: "actualCurrentRent" };
    }
    const reference = args.neighborhood !== undefined ? table[args.neighborhood] : undefined;
    if (reference !== undefined) {
      return { rentPerM2: reference, source: "neighborhoodReference" };
    }
    return { rentPerM2: null, source: "none" };
  }

  return {
    longTerm: rateFor("longTerm", NEIGHBORHOOD_RENT_LONG_TERM.value),
    shortTerm: rateFor("shortTerm", NEIGHBORHOOD_RENT_SHORT_TERM.value),
    usableAreaM2,
    usableAreaWasDerived,
  };
}
