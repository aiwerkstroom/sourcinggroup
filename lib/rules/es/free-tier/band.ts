/**
 * The free indication's band (UI_SPEC.md §2, CLAUDE.md §4/§6).
 *
 * This is a deliberately separate, simpler calculation path - not
 * runEngine() with the missing second-order fields filled in. CLAUDE.md §6
 * is explicit that a value the customer has not supplied is a reason to
 * write a smaller function, never a reason to feed the main engine an
 * assumption. So: no financing, no exit, no IRR, no projection, no
 * scenario layer, and long-term rental only.
 *
 * What the customer sees is a band rather than a point. The same
 * calculation runs twice, once at the least and once at the most
 * favourable standing-in value for each of the three second-order fields
 * the free form does not ask about:
 *
 *   - gastos de comunidad      FREE_TIER_BAND_COMMUNITY_FEES_{UN,}FAVOURABLE
 *   - staat van onderhoud      FREE_TIER_BAND_RENOVATION_TIER_{UN,}FAVOURABLE
 *   - rent vs. wijk average    FREE_TIER_BAND_RENT_MARGIN
 *
 * Three deliberate non-drivers, held at a single value in both runs
 * because no documented range exists to span them with, and reported as
 * unverified instead (UI_SPEC.md §6.9): the cadastral/purchase-price
 * ratio, the usable/built area ratio, and long-term occupancy.
 *
 * Short-term rental is not a band dimension. The título habilitante is a
 * yes/no gate that makes scenarios disappear (UI_SPEC.md §4), not a
 * sliding scale, and a band whose ends were "without permit" and "with
 * permit" would put two incomparable products on one axis. The free
 * indication therefore always computes long-term rental - the assumption
 * that is valid whatever the permit situation turns out to be - and says
 * so in `disclosures.shortTermLicence`.
 *
 * Relationship to the main engine: the cost structure here is the base
 * scenario's, with debt service removed. Every rate and cost line is the
 * same parameter scenarios.ts uses, and the base scenario's own
 * multipliers are all 1.0 by definition, so this path does not
 * re-multiply by them. A drift test pins that (band.test.ts): if any base
 * multiplier ever moves off 1.0, this module's silence about the scenario
 * layer stops being harmless and the test fails rather than letting the
 * two paths quietly diverge.
 */

import { incomeLine } from "../income";
import { fixedOperatingCosts, utilitiesBaseAnnual } from "../operating";
import {
  BANK_FEE,
  BASE_OCCUPANCY_LONG_TERM,
  DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO,
  DEFAULT_USABLE_TO_BUILT_AREA_RATIO,
  FREE_TIER_BAND_COMMUNITY_FEES_FAVOURABLE,
  FREE_TIER_BAND_COMMUNITY_FEES_UNFAVOURABLE,
  FREE_TIER_BAND_RENOVATION_TIER_FAVOURABLE,
  FREE_TIER_BAND_RENOVATION_TIER_UNFAVOURABLE,
  FREE_TIER_BAND_RENT_MARGIN,
  MAINTENANCE_RATE,
  NEIGHBORHOOD_RENT_LONG_TERM,
  PROPERTY_MANAGEMENT_FEE,
  RENOVATION_STRATEGIES,
} from "../parameters";
import type {
  FreeTierBand,
  FreeTierBandEnd,
  FreeTierBandInput,
  FreeTierDisclosures,
  Parameter,
  RenovationStrategyId,
} from "../types";

const MONTHS_PER_YEAR = 12;

/**
 * The Dutch copy that ships with the number (CLAUDE.md §6: Nederlands in
 * de UI). Kept next to the calculation and attached to its result rather
 * than left to the page that renders it, because each line explains a
 * limitation of this specific figure - a band rendered without them says
 * something the model does not support.
 */
export const FREE_TIER_DISCLOSURES: FreeTierDisclosures = {
  band:
    "Deze bandbreedte laat zien wat we nog niet van uw pand weten — servicekosten, " +
    "staat van onderhoud en hoe de huur zich verhoudt tot het wijkgemiddelde. De " +
    "uiteinden zijn de gunstigste en ongunstigste combinatie van die drie, niet de " +
    "kans dat het zo uitpakt. De werkelijke uitkomst ligt waarschijnlijk dichter bij " +
    "het midden dan bij de randen.",
  shortTermLicence:
    "Kortetermijnverhuur vereist sinds 31 maart 2026 een título habilitante in " +
    "Valencia. Deze indicatie rekent met langetermijnverhuur; met vergunning kan het " +
    "rendement hoger uitvallen. Dat is niet in dit bedrag verwerkt.",
  financing:
    "Dit bedrag is de cashflow vóór financiering. De gratis indicatie vraagt geen " +
    "hypotheek- of vermogensgegevens, dus rente en aflossing zijn er niet van " +
    "afgetrokken.",
  unverified:
    "Niet geverifieerd in deze indicatie: het bruikbaar oppervlak (afgeleid uit het " +
    "gebouwde oppervlak), de kadastrale waarde (benaderd met de vraagprijs) en de " +
    "bezettingsgraad. In het betaalde rapport vult u deze zelf in.",
};

/**
 * The PLACEHOLDER parameters one end of the band actually rests on.
 *
 * Narrower than outcome.ts's list, because this path computes less. Two
 * differences worth naming:
 *
 * - The renovation tier contributes three of its five PLACEHOLDER fields,
 *   not all five. `capex` and `timeToRentMonths` change what an
 *   acquisition costs and how long it stands empty; neither enters a
 *   steady-state monthly cashflow before financing, so listing them would
 *   overstate what this figure depends on.
 * - DEFAULT_USABLE_TO_BUILT_AREA_RATIO and
 *   DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO are unconditional here.
 *   outcome.ts makes them conditional because the paid path can be given a
 *   measured usable area and a real cadastral value; the free form asks
 *   for neither, by design, so both always apply.
 */
function collectPlaceholders(renovationStrategy: RenovationStrategyId): Parameter<unknown>[] {
  const renovation = RENOVATION_STRATEGIES[renovationStrategy];
  return [
    FREE_TIER_BAND_RENT_MARGIN,
    DEFAULT_USABLE_TO_BUILT_AREA_RATIO,
    DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO,
    BASE_OCCUPANCY_LONG_TERM,
    MAINTENANCE_RATE,
    BANK_FEE,
    renovation.rentMultiplier,
    renovation.maintenanceFactor,
    renovation.utilitiesEfficiency,
  ];
}

/**
 * One end of the band. `rentMarginDirection` is +1 at the favourable end
 * and -1 at the unfavourable one: the margin is symmetric around the
 * neighbourhood average by construction, so both ends read the same
 * parameter rather than two separately maintained numbers.
 */
function computeEnd(args: {
  end: "unfavourable" | "favourable";
  input: FreeTierBandInput;
  referenceRentPerM2: number;
  rentMarginDirection: 1 | -1;
  renovationStrategy: RenovationStrategyId;
  communityFeesAnnual: number;
}): FreeTierBandEnd {
  const renovation = RENOVATION_STRATEGIES[args.renovationStrategy];

  const rentPerM2 =
    args.referenceRentPerM2 * (1 + args.rentMarginDirection * FREE_TIER_BAND_RENT_MARGIN.value);

  // MODEL_SPEC.md §17: rent is earned on usable area. The free form only
  // asks for built area, so this is always the derived, never the
  // measured, figure.
  const usableAreaM2 = args.input.builtAreaM2 * DEFAULT_USABLE_TO_BUILT_AREA_RATIO.value;

  // Long-term only - see the module docstring on the permit gate.
  const income = incomeLine(
    rentPerM2,
    usableAreaM2,
    BASE_OCCUPANCY_LONG_TERM.value,
    renovation.rentMultiplier.value,
  );
  const grossAnnualRent = income.adjustedAnnualIncome;

  const propertyManagement = grossAnnualRent * PROPERTY_MANAGEMENT_FEE.value;
  const maintenance =
    grossAnnualRent * MAINTENANCE_RATE.value * renovation.maintenanceFactor.value;
  const utilities =
    utilitiesBaseAnnual(args.input.builtAreaM2) * renovation.utilitiesEfficiency.value;

  // mortgageAmount 0 / rate 0 is not a stand-in for an unknown loan: the
  // free indication genuinely has no debt, so the mortgage interest line
  // is exactly zero. Reusing fixedOperatingCosts keeps the IBI base
  // (incl. DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO) defined in one place
  // instead of restating the formula here.
  const fixed = fixedOperatingCosts({
    purchasePrice: args.input.purchasePrice,
    mortgageAmount: 0,
    effectiveInterestRate: 0,
    communityFeesAnnual: args.communityFeesAnnual,
  });
  const fixedCosts =
    fixed.propertyTaxIBI + fixed.insurance + fixed.bankAccountFee + fixed.communityFees;

  const annualCashflowBeforeFinancing =
    grossAnnualRent - (propertyManagement + maintenance + utilities + fixedCosts);

  return {
    end: args.end,
    rentPerM2,
    usableAreaM2,
    grossAnnualRent,
    propertyManagement,
    maintenance,
    utilities,
    propertyTaxIBI: fixed.propertyTaxIBI,
    insurance: fixed.insurance,
    bankAccountFee: fixed.bankAccountFee,
    communityFees: fixed.communityFees,
    fixedCosts,
    annualCashflowBeforeFinancing,
    monthlyCashflowBeforeFinancing: annualCashflowBeforeFinancing / MONTHS_PER_YEAR,
    renovationStrategy: args.renovationStrategy,
    placeholdersUsed: collectPlaceholders(args.renovationStrategy),
  };
}

/** De-duplicates by parameter name, keeping first-seen order. */
function mergePlaceholders(
  ...lists: ReadonlyArray<ReadonlyArray<Parameter<unknown>>>
): Parameter<unknown>[] {
  const seen = new Set<string>();
  const merged: Parameter<unknown>[] = [];
  for (const list of lists) {
    for (const p of list) {
      if (seen.has(p.name)) continue;
      seen.add(p.name);
      merged.push(p);
    }
  }
  return merged;
}

/**
 * The free indication for one property. Throws on an unknown wijk rather
 * than falling back to a city average: the neighbourhood is the single
 * largest driver of the rent estimate, and the free form offers the 13
 * covered wijken as a closed dropdown precisely so this cannot happen
 * silently.
 */
export function computeFreeTierBand(input: FreeTierBandInput): FreeTierBand {
  const referenceRentPerM2 = NEIGHBORHOOD_RENT_LONG_TERM.value[input.neighborhood];
  if (referenceRentPerM2 === undefined) {
    throw new Error(
      `No long-term reference rent for neighbourhood "${input.neighborhood}". ` +
        `Known: ${Object.keys(NEIGHBORHOOD_RENT_LONG_TERM.value).join(", ")}`,
    );
  }
  if (!(input.builtAreaM2 > 0)) {
    throw new Error("computeFreeTierBand needs a positive builtAreaM2");
  }
  if (!(input.purchasePrice > 0)) {
    throw new Error("computeFreeTierBand needs a positive purchasePrice");
  }

  const unfavourable = computeEnd({
    end: "unfavourable",
    input,
    referenceRentPerM2,
    rentMarginDirection: -1,
    renovationStrategy: FREE_TIER_BAND_RENOVATION_TIER_UNFAVOURABLE.value,
    communityFeesAnnual: FREE_TIER_BAND_COMMUNITY_FEES_UNFAVOURABLE.value,
  });
  const favourable = computeEnd({
    end: "favourable",
    input,
    referenceRentPerM2,
    rentMarginDirection: 1,
    renovationStrategy: FREE_TIER_BAND_RENOVATION_TIER_FAVOURABLE.value,
    communityFeesAnnual: FREE_TIER_BAND_COMMUNITY_FEES_FAVOURABLE.value,
  });

  return {
    neighborhood: input.neighborhood,
    referenceRentPerM2,
    unfavourable,
    favourable,
    monthlyCashflowBeforeFinancing: {
      low: unfavourable.monthlyCashflowBeforeFinancing,
      high: favourable.monthlyCashflowBeforeFinancing,
    },
    placeholdersUsed: mergePlaceholders(
      unfavourable.placeholdersUsed,
      favourable.placeholdersUsed,
    ),
    disclosures: FREE_TIER_DISCLOSURES,
  };
}
