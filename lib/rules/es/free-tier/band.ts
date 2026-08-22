/**
 * The free indication's band (UI_SPEC.md §2, CLAUDE.md §4/§6).
 *
 * This is a deliberately separate, simpler calculation path - not
 * runEngine() with the missing second-order fields filled in. CLAUDE.md §6
 * is explicit that a value the customer has not supplied is a reason to
 * write a smaller function, never a reason to feed the main engine an
 * assumption. So: no exit, no IRR, no projection, no scenario layer, and
 * long-term rental only.
 *
 * Financing is the one deliberate exception (fase A stap 3), and it is
 * exactly that: a documented exception, not a quiet reversal of the rule
 * above. Showing a cashflow figure with debt service left out was the
 * core of the bait-and-switch this fix exists to close - a number that
 * looked like real monthly cashflow but was not one a customer could
 * actually bank. Rather than ask for LTV/equity the free form still does
 * not collect, this reuses FINANCING_STRATEGIES.medium (70% LTV, 20
 * years) plus NON_RESIDENT_INTEREST_SPREAD exactly as the paid engine
 * already defines and documents them - no new parameter, and the
 * assumption is disclosed by name (LTV/term/rate) via the "financing" key
 * below, not left implicit.
 *
 * What the customer sees is a band rather than a point. The same
 * calculation runs twice, once at the least and once at the most
 * favourable standing-in value for each of three second-order fields the
 * free form did not ask about:
 *
 *   - gastos de comunidad      FREE_TIER_BAND_COMMUNITY_FEES_{UN,}FAVOURABLE
 *   - staat van onderhoud      FREE_TIER_BAND_RENOVATION_TIER_{UN,}FAVOURABLE
 *   - rent vs. wijk average    FREE_TIER_BAND_RENT_MARGIN
 *
 * Fase A stap 1: the free form now asks for all three anyway, optionally.
 * Left blank, a dimension still runs the favourable/unfavourable pair
 * above, exactly as before this fix. Given, that dimension's customer
 * figure replaces the pair at BOTH ends - resolveCommunityFeesAnnual(),
 * resolveRenovationStrategy() and resolveRentMarginDirection() below each
 * do this for their own dimension, independently: filling in one, two or
 * all three narrows the band by however much that dimension used to
 * contribute to the spread, nothing more.
 *
 * Fase A stap 2: filling in all three collapses both ends to the same
 * number - not a bug, and not schijnprecisie (UI_SPEC.md §1's own
 * objection to false precision): the figure is now built entirely from
 * the customer's own three answers rather than a standing-in placeholder
 * pair, so the extra precision is earned, not invented. FreeTierBand.
 * pointEstimate is true exactly then, and a page is expected to render a
 * single figure rather than a range at that point - see this function's
 * own comment on `pointEstimate` below for how the disclosure list stays
 * in lockstep with it.
 *
 * Three deliberate non-drivers, held at a single value in both runs
 * because no documented range exists to span them with, and reported as
 * unverified instead (UI_SPEC.md §6.9): the cadastral/purchase-price
 * ratio, the usable/built area ratio, and long-term occupancy. Unaffected
 * by fase A stap 1 - the free form still does not ask about any of them.
 *
 * Short-term rental is not a band dimension. The título habilitante is a
 * yes/no gate that makes scenarios disappear (UI_SPEC.md §4), not a
 * sliding scale, and a band whose ends were "without permit" and "with
 * permit" would put two incomparable products on one axis. The free
 * indication therefore always computes long-term rental - the assumption
 * that is valid whatever the permit situation turns out to be - and flags
 * this via the "shortTermLicence" disclosure key (see below).
 *
 * Relationship to the main engine: the cost structure here is the base
 * scenario's, with debt service removed. Every rate and cost line is the
 * same parameter scenarios.ts uses, and the base scenario's own
 * multipliers are all 1.0 by definition, so this path does not
 * re-multiply by them. A drift test pins that (free-tier-band.test.ts): if
 * any base multiplier ever moves off 1.0, this module's silence about the
 * scenario layer stops being harmless and the test fails rather than
 * letting the two paths quietly diverge.
 *
 * Disclosures ship as keys, not text (CLAUDE.md §6: this module stays
 * English). FreeTierBand.disclosures is a list of FreeTierDisclosureKey;
 * the Dutch sentence each one maps to lives in
 * lib/copy/es/free-tier-disclosures.ts, outside the calculation layer, so
 * a page can only show the band by resolving every key through that
 * translation - there is no path that renders the figure and skips the
 * framing.
 */

import { annualAnnuityDebtService } from "../financing";
import { incomeLine } from "../income";
import { fixedOperatingCosts, utilitiesBaseAnnual } from "../operating";
import {
  BANK_FEE,
  BASE_OCCUPANCY_LONG_TERM,
  DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO,
  DEFAULT_USABLE_TO_BUILT_AREA_RATIO,
  FINANCING_STRATEGIES,
  FREE_TIER_BAND_COMMUNITY_FEES_FAVOURABLE,
  FREE_TIER_BAND_COMMUNITY_FEES_UNFAVOURABLE,
  FREE_TIER_BAND_RENOVATION_TIER_FAVOURABLE,
  FREE_TIER_BAND_RENOVATION_TIER_UNFAVOURABLE,
  FREE_TIER_BAND_RENT_MARGIN,
  MAINTENANCE_RATE,
  NEIGHBORHOOD_RENT_LONG_TERM,
  NON_RESIDENT_INTEREST_SPREAD,
  PROPERTY_MANAGEMENT_FEE,
  RENOVATION_STRATEGIES,
  RENOVATION_TIER_BY_MAINTENANCE_CONDITION,
} from "../parameters";
import type {
  FreeTierBand,
  FreeTierBandEnd,
  FreeTierBandInput,
  FreeTierDisclosureKey,
  FreeTierRentLevel,
  MaintenanceCondition,
  Parameter,
  RenovationStrategyId,
} from "../types";

const MONTHS_PER_YEAR = 12;

/**
 * Every disclosure that applies to this band, as keys - not text. The
 * Dutch copy each key maps to (CLAUDE.md §6: Nederlands in de UI, Engels
 * in de code en commentaar) lives in lib/copy/es/free-tier-disclosures.ts,
 * outside the calculation layer, so this module and everything under
 * lib/rules/es stay English. All four currently apply unconditionally -
 * none is specific to a wijk, a price or an area - so this is a constant,
 * not something computeFreeTierBand derives per call.
 */
export const FREE_TIER_DISCLOSURE_KEYS: readonly FreeTierDisclosureKey[] = [
  "band",
  "shortTermLicence",
  "financing",
  "unverified",
];

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
 * - FREE_TIER_BAND_RENT_MARGIN (fase A stap 1) is conditional on
 *   `rentMarginUsed`: still a real driver whenever the ±8% figure itself
 *   is what produces this end's rentPerM2 - which is every case except
 *   rentLevel "average", where the margin is exactly 0 and this
 *   PLACEHOLDER genuinely plays no role.
 */
function collectPlaceholders(
  renovationStrategy: RenovationStrategyId,
  rentMarginUsed: boolean,
): Parameter<unknown>[] {
  const renovation = RENOVATION_STRATEGIES[renovationStrategy];
  const placeholders: Parameter<unknown>[] = [];
  if (rentMarginUsed) placeholders.push(FREE_TIER_BAND_RENT_MARGIN);
  placeholders.push(
    DEFAULT_USABLE_TO_BUILT_AREA_RATIO,
    DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO,
    BASE_OCCUPANCY_LONG_TERM,
    MAINTENANCE_RATE,
    BANK_FEE,
    renovation.rentMultiplier,
    renovation.maintenanceFactor,
    renovation.utilitiesEfficiency,
  );
  return placeholders;
}

/**
 * Resolves "staat van onderhoud" to a single renovation tier when the
 * customer supplied one (fase A stap 1), via the same
 * RENOVATION_TIER_BY_MAINTENANCE_CONDITION mapping deriveRenovationStrategy()
 * already uses for the paid wizard - no new derivation rule, no new
 * PLACEHOLDER. Falls back to the caller's own end-specific standing-in
 * tier (FREE_TIER_BAND_RENOVATION_TIER_{UN,}FAVOURABLE) when not given.
 */
function resolveRenovationStrategy(
  maintenanceCondition: MaintenanceCondition | undefined,
  fallback: RenovationStrategyId,
): RenovationStrategyId {
  return maintenanceCondition !== undefined
    ? RENOVATION_TIER_BY_MAINTENANCE_CONDITION.value[maintenanceCondition]
    : fallback;
}

/**
 * Resolves gastos de comunidad to a single figure when the customer
 * supplied one (fase A stap 1), replacing the caller's own end-specific
 * standing-in value (FREE_TIER_BAND_COMMUNITY_FEES_{UN,}FAVOURABLE).
 */
function resolveCommunityFeesAnnual(override: number | undefined, fallback: number): number {
  return override ?? fallback;
}

/**
 * Resolves how this property's rent compares to the wijk average to a
 * single margin direction when the customer supplied one (fase A stap 1):
 * "below"/"above" collapse both ends to the same -1/+1 direction
 * FREE_TIER_BAND_RENT_MARGIN.value already defines; "average" drops the
 * margin to exactly 0, at which point FREE_TIER_BAND_RENT_MARGIN's own
 * value plays no role at all (see collectPlaceholders() above). Falls back
 * to the caller's own end-specific direction when not given, reproducing
 * today's ±8% split exactly.
 */
function resolveRentMarginDirection(
  rentLevel: FreeTierRentLevel | undefined,
  fallback: 1 | -1,
): 1 | -1 | 0 {
  if (rentLevel === undefined) return fallback;
  if (rentLevel === "below") return -1;
  if (rentLevel === "above") return 1;
  return 0;
}

/**
 * Fase A stap 3: the fixed financing assumption every free indication
 * uses, since the free form asks for no LTV/equity preference to derive
 * one from. FINANCING_STRATEGIES.medium exactly, the paid engine's own
 * middle tier (Costs & Income!F104/F106) - reused, not duplicated, so
 * this figure and the paid report's own "medium" tier can never drift
 * apart. NON_RESIDENT_INTEREST_SPREAD applies unconditionally: CLAUDE.md
 * §1's audience is a Dutch investor, non-resident by definition, the same
 * fixed premise build-engine-input.ts's own FIXED_RESIDENCY already
 * hard-codes for the paid wizard.
 */
const FREE_TIER_FINANCING_TIER = FINANCING_STRATEGIES.medium;
const FREE_TIER_EFFECTIVE_INTEREST_RATE =
  FREE_TIER_FINANCING_TIER.interestRate.value + NON_RESIDENT_INTEREST_SPREAD.value;

/**
 * One end of the band. `rentMarginDirection` is +1 at the favourable end
 * and -1 at the unfavourable one when the customer left rentLevel blank:
 * the margin is symmetric around the neighbourhood average by
 * construction, so both ends read the same parameter rather than two
 * separately maintained numbers. Given a rentLevel, both ends receive the
 * same resolved direction instead (fase A stap 1) - 0 is "average", where
 * the margin plays no role at either end.
 */
function computeEnd(args: {
  end: "unfavourable" | "favourable";
  input: FreeTierBandInput;
  referenceRentPerM2: number;
  rentMarginDirection: 1 | -1 | 0;
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

  // mortgageAmount 0 / rate 0 here on purpose, unrelated to fase A stap 3:
  // fixedOperatingCosts()'s own mortgageInterest line is an interest-only
  // figure the paid engine's tax layer uses, not the amortising annuity a
  // real monthly payment is - scenarios.ts (the paid engine) keeps that
  // line out of its own cashflow for the exact same reason and computes
  // debt service separately via annualAnnuityDebtService(), same as
  // below. Reusing fixedOperatingCosts still keeps the IBI base (incl.
  // DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO) defined in one place
  // instead of restating the formula here.
  const fixed = fixedOperatingCosts({
    purchasePrice: args.input.purchasePrice,
    mortgageAmount: 0,
    effectiveInterestRate: 0,
    communityFeesAnnual: args.communityFeesAnnual,
  });
  const fixedCosts =
    fixed.propertyTaxIBI + fixed.insurance + fixed.bankAccountFee + fixed.communityFees;

  // Fase A stap 3: the amortising annual payment on FREE_TIER_FINANCING_TIER's
  // fixed assumption - same function, same shape as the paid engine's own
  // debt service (financing.ts), applied to a mortgage sized off this
  // property's own purchasePrice. Identical at both ends: neither the LTV
  // nor the rate nor the term is a band dimension (this fix's own design:
  // "de financieringsaanname is altijd vast, geen band-driver"), only the
  // purchasePrice-derived mortgageAmount varies per property, and that is
  // shared between both ends already.
  const mortgageAmount = args.input.purchasePrice * FREE_TIER_FINANCING_TIER.ltv.value;
  const annualDebtService = annualAnnuityDebtService(
    FREE_TIER_EFFECTIVE_INTEREST_RATE,
    FREE_TIER_FINANCING_TIER.loanTermYears.value,
    mortgageAmount,
  );

  // Fase A stap 3: was annualCashflowBeforeFinancing. Financing is no
  // longer excluded, so the qualifier is gone rather than kept and
  // misleading - this is now the figure a customer could actually bank.
  const annualCashflow =
    grossAnnualRent - (propertyManagement + maintenance + utilities + fixedCosts + annualDebtService);

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
    mortgageAmount,
    annualDebtService,
    annualCashflow,
    monthlyCashflow: annualCashflow / MONTHS_PER_YEAR,
    renovationStrategy: args.renovationStrategy,
    placeholdersUsed: collectPlaceholders(args.renovationStrategy, args.rentMarginDirection !== 0),
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
    rentMarginDirection: resolveRentMarginDirection(input.rentLevel, -1),
    renovationStrategy: resolveRenovationStrategy(
      input.maintenanceCondition,
      FREE_TIER_BAND_RENOVATION_TIER_UNFAVOURABLE.value,
    ),
    communityFeesAnnual: resolveCommunityFeesAnnual(
      input.communityFeesAnnual,
      FREE_TIER_BAND_COMMUNITY_FEES_UNFAVOURABLE.value,
    ),
  });
  const favourable = computeEnd({
    end: "favourable",
    input,
    referenceRentPerM2,
    rentMarginDirection: resolveRentMarginDirection(input.rentLevel, 1),
    renovationStrategy: resolveRenovationStrategy(
      input.maintenanceCondition,
      FREE_TIER_BAND_RENOVATION_TIER_FAVOURABLE.value,
    ),
    communityFeesAnnual: resolveCommunityFeesAnnual(
      input.communityFeesAnnual,
      FREE_TIER_BAND_COMMUNITY_FEES_FAVOURABLE.value,
    ),
  });

  // Fase A stap 2: three given, not just some, is qualitatively different
  // from "narrowed" - both ends are now built entirely from the
  // customer's own figures, so the band has collapsed to a point rather
  // than merely shrunk. `pointEstimate` is the structural signal a page
  // branches its layout on (a point vs. a range); the disclosure key
  // swapped in below is the text signal, kept in lockstep with it rather
  // than derived independently, so the two can never disagree about
  // which case this is.
  const givenCount = [
    input.communityFeesAnnual !== undefined,
    input.maintenanceCondition !== undefined,
    input.rentLevel !== undefined,
  ].filter(Boolean).length;
  const pointEstimate = givenCount === 3;

  // Kept as a reference to the shared constant when nothing is narrowed,
  // not a freshly allocated copy, so a caller comparing disclosures by
  // reference for the unnarrowed case is unaffected. "band" explains what
  // a range means (favourable/unfavourable ends, not a probability) -
  // once collapsed to a point there are no ends left for that text to
  // describe, so pointEstimateFromCustomerInput replaces it rather than
  // sitting alongside narrowedByCustomerInput.
  let disclosures: readonly FreeTierDisclosureKey[];
  if (pointEstimate) {
    disclosures = [
      ...FREE_TIER_DISCLOSURE_KEYS.filter((key) => key !== "band"),
      "pointEstimateFromCustomerInput",
    ];
  } else if (givenCount > 0) {
    disclosures = [...FREE_TIER_DISCLOSURE_KEYS, "narrowedByCustomerInput"];
  } else {
    disclosures = FREE_TIER_DISCLOSURE_KEYS;
  }

  return {
    neighborhood: input.neighborhood,
    referenceRentPerM2,
    unfavourable,
    favourable,
    monthlyCashflow: {
      low: unfavourable.monthlyCashflow,
      high: favourable.monthlyCashflow,
    },
    pointEstimate,
    placeholdersUsed: mergePlaceholders(
      unfavourable.placeholdersUsed,
      favourable.placeholdersUsed,
    ),
    disclosures,
  };
}
