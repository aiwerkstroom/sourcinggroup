/**
 * Generation of the synthetic reference distribution the TSG percentile is
 * measured against (SCORE_SPEC.md §5): 1.000 independently generated
 * synthetic cases, each run through the full engine and scored, keeping
 * only the total score.
 *
 * Placement note: SCORE_SPEC.md §6 writes this file as
 * /lib/distribution/generate.ts. It sits at lib/rules/es/distribution/
 * instead, for the same reason score.ts documents: it is an engine
 * component (runs runEngine/buildProjectionYears/computeExit/
 * computeScenarioIrr/buildScenarioOutcome/computeTsgScore end to end,
 * exactly like a real request would) and belongs next to what it drives.
 *
 * Every range, share and no-default fixture this module samples from
 * lives in parameters.ts as a named ESTIMATE (TSG_SCORE_DISTRIBUTION_*),
 * never inline here, per the same house rule the rest of the calculation
 * layer follows.
 *
 * Determinism (SCORE_SPEC.md §6: "de scoring is deterministisch"): this
 * module uses a seeded PRNG, not Math.random(), so the same seed always
 * produces the same 1.000 cases and therefore the same distribution - the
 * mulberry32 constants inside nextRandom() are the algorithm's own fixed
 * arithmetic, not a business or reality assumption, so they stay inline
 * rather than in parameters.ts (they are analogous to a sort comparator's
 * internals, not a domain value).
 */

import { computeExit } from "../exit";
import { runEngine } from "../engine";
import { computeScenarioIrr } from "../irr";
import { buildScenarioOutcome } from "../outcome";
import {
  FINANCING_STRATEGIES,
  NEIGHBORHOOD_RENT_LONG_TERM,
  NEIGHBORHOOD_RENT_SHORT_TERM,
  RENOVATION_STRATEGIES,
  TSG_SCORE_DISTRIBUTION_AREA_RANGE_M2,
  TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_RANGE,
  TSG_SCORE_DISTRIBUTION_CONSTRAINTS,
  TSG_SCORE_DISTRIBUTION_EQUITY_COVERAGE_RANGE,
  TSG_SCORE_DISTRIBUTION_EXIT_ASSUMPTIONS,
  TSG_SCORE_DISTRIBUTION_HOLDING_PERIOD_RANGE_YEARS,
  TSG_SCORE_DISTRIBUTION_PREFERRED_LTV_RANGE,
  TSG_SCORE_DISTRIBUTION_PRICE_TO_RENT_MULTIPLIER_RANGE,
  TSG_SCORE_DISTRIBUTION_RENTAL_STRATEGY_SHARES,
  TSG_SCORE_DISTRIBUTION_SAMPLE_SIZE,
  TSG_SCORE_DISTRIBUTION_SEED,
} from "../parameters";
import { buildProjectionYears } from "../projection";
import { computeTsgScore } from "../score";
import type { EngineInput, FinancingStrategyId, RenovationStrategyId, ScoreDistribution } from "../types";

/** mulberry32: a small, fast, seeded PRNG - deterministic across platforms and Node versions, unlike Math.random(). */
function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return function nextRandom(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function uniform(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** A whole number uniformly drawn from [min, max], both inclusive. */
function uniformInt(rng: () => number, min: number, max: number): number {
  return min + Math.min(max - min, Math.floor(rng() * (max - min + 1)));
}

function pickIndex(rng: () => number, length: number): number {
  return Math.min(length - 1, Math.floor(rng() * length));
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[pickIndex(rng, items.length)]!;
}

/**
 * One case's rental strategy, drawn from SCORE_SPEC.md §5's
 * langetermijn(70%)/hybride(30%) mix. "shortTerm" is never generated - the
 * spec's list does not include it.
 */
function pickRentalStrategy(rng: () => number): "longTerm" | "hybrid" {
  return rng() < TSG_SCORE_DISTRIBUTION_RENTAL_STRATEGY_SHARES.value.longTerm
    ? "longTerm"
    : "hybrid";
}

/** builtAreaM2, purchasePrice, communityFeesAnnual, preferredLtv and holdingYears as buildSyntheticEngineInput() derived them, exposed for tests that check the derivation itself rather than only its downstream score. */
export interface SyntheticCaseDerivedFigures {
  builtAreaM2: number;
  neighborhood: string;
  priceToRentMultiplier: number;
  purchasePrice: number;
  communityFeesAnnual: number;
  preferredLtv: number;
  holdingYears: number;
}

/**
 * Builds one synthetic EngineInput (SCORE_SPEC.md §5's bullet list,
 * corrected per Samuel's review of earlier drafts):
 *
 * 1. Purchase price is no longer drawn independently of floor area - it is
 *    derived from the neighborhood's own rent table (price = annual rent
 *    per m² x a price-to-rent multiplier x builtAreaM2), so a case's price
 *    and area are no longer free to combine into an implausible pairing
 *    (a huge cheap unit, a tiny expensive one).
 * 2. Gastos de comunidad is drawn from a range per case, not fixed at
 *    € 900 for every one regardless of the building.
 * 3. Leverage now actually varies per case. Drawing financingStrategy
 *    alone did NOT vary leverage in practice: TSG_SCORE_DISTRIBUTION_
 *    CONSTRAINTS.minLtv used to be 0.6, so clampLtv() (financing.ts)
 *    clamped every strategy's LTV (60%/70%/75%) into the same narrow
 *    60%-75% band regardless of which was drawn - nearly every case ended
 *    up highly leveraged, which structurally weakens cashflow and DSCR
 *    (an amortising loan on 60%+ LTV rarely leaves much room at a
 *    market-consistent rental yield). A preferredLtv is now drawn per case
 *    from TSG_SCORE_DISTRIBUTION_PREFERRED_LTV_RANGE (0-0.75, an all-cash
 *    purchase up to the engine's own highest existing leverage tier) and
 *    minLtv is lowered to 0 so that draw reaches clampLtv() unclamped.
 *    financingStrategy is still drawn too - with preferredLtv set, it now
 *    controls only loanTermYears (selectFinancing() takes the rate from
 *    whichever tier preferredLtv falls into, not from financingStrategy).
 *    No new financing mechanism: both preferredLtv and minLtv are existing
 *    InvestorConstraints fields the engine already reads.
 * 4. Holding period now varies per case too, drawn from
 *    TSG_SCORE_DISTRIBUTION_HOLDING_PERIOD_RANGE_YEARS (5-15 years)
 *    instead of every case using the same fixed PROJECTION_YEARS (10).
 *
 * `constraints.totalBudget` here is PROVISIONAL: any positive number would
 * do, because totalBudget feeds exactly one thing downstream
 * (AcquisitionCosts.withinTotalBudget, a diagnostic flag this generator
 * never reads - not equityRequired, not any score dimension) and nothing
 * else in the engine's calculation chain depends on it. purchasePrice is
 * used as that placeholder only because it is guaranteed positive, not
 * because it carries any meaning here. The real figure (equityAvailable) is
 * derived once equityRequired is known - see deriveSyntheticEquitySupply().
 *
 * Every generated case still sets hasTouristRentalLicense: true. §5's
 * rental mix includes a 30% "hybrid" share, which MODEL_SPEC.md §18
 * rejects without a valid título habilitante; §5 does not vary license
 * status, so fixing it to true (rather than drawing it and then
 * rejecting/reweighting hybrid draws) is the same "defaults uit
 * parameters.ts" treatment §5 already applies to the exit assumptions and
 * the remaining constraints.
 *
 * Separated from scoreOneCase() so the sampling/derivation logic itself -
 * the part the corrections above changed - can be unit-tested directly
 * against the figures it derived, not only indirectly through a final
 * score.
 */
export function buildSyntheticEngineInput(rng: () => number): {
  input: EngineInput;
  derived: SyntheticCaseDerivedFigures;
} {
  const areaRange = TSG_SCORE_DISTRIBUTION_AREA_RANGE_M2.value;
  const builtAreaM2 = uniform(rng, areaRange.min, areaRange.max);

  const neighborhoods = Object.keys(NEIGHBORHOOD_RENT_LONG_TERM.value);
  const neighborhood = pick(rng, neighborhoods);
  const rentPerM2LongTerm = NEIGHBORHOOD_RENT_LONG_TERM.value[neighborhood]!;
  const rentPerM2ShortTerm = NEIGHBORHOOD_RENT_SHORT_TERM.value[neighborhood]!;

  // Purchase price per m² tracks the neighborhood's own rent level, with a
  // freshly drawn multiplier per case standing in for the "spreiding
  // eromheen" a single fixed multiplier would not have.
  const multiplierRange = TSG_SCORE_DISTRIBUTION_PRICE_TO_RENT_MULTIPLIER_RANGE.value;
  const priceToRentMultiplier = uniform(rng, multiplierRange.min, multiplierRange.max);
  const purchasePrice = rentPerM2LongTerm * 12 * priceToRentMultiplier * builtAreaM2;

  const communityFeesRange = TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_RANGE.value;
  const communityFeesAnnual = uniform(rng, communityFeesRange.min, communityFeesRange.max);

  const financingStrategy = pick(
    rng,
    Object.keys(FINANCING_STRATEGIES) as FinancingStrategyId[],
  );
  const renovationStrategy = pick(
    rng,
    Object.keys(RENOVATION_STRATEGIES) as RenovationStrategyId[],
  );
  const rentalStrategy = pickRentalStrategy(rng);

  const ltvRange = TSG_SCORE_DISTRIBUTION_PREFERRED_LTV_RANGE.value;
  const preferredLtv = uniform(rng, ltvRange.min, ltvRange.max);

  const holdingPeriodRange = TSG_SCORE_DISTRIBUTION_HOLDING_PERIOD_RANGE_YEARS.value;
  const holdingYears = uniformInt(rng, holdingPeriodRange.min, holdingPeriodRange.max);

  const constraints = TSG_SCORE_DISTRIBUTION_CONSTRAINTS.value;

  const input: EngineInput = {
    property: {
      name: "Synthetic distribution case",
      region: "Valencia",
      neighborhood,
      builtAreaM2,
      purchasePrice,
      communityFeesAnnual,
      hasTouristRentalLicense: true,
    },
    constraints: {
      totalBudget: purchasePrice, // provisional - see docstring above
      maxRenovationBudget: constraints.maxRenovationBudget,
      minLtv: constraints.minLtv,
      maxLtv: constraints.maxLtv,
      preferredLtv,
      minRoiTarget: constraints.minRoiTarget,
      minMonthlyCashflow: constraints.minMonthlyCashflow,
      maxMonthlyDebt: constraints.maxMonthlyDebt,
    },
    selections: {
      rentPerM2LongTerm,
      rentPerM2ShortTerm,
      rentalStrategy,
      renovationStrategy,
      financingStrategy,
      residency: "nonResident",
      euResident: true,
    },
  };

  return {
    input,
    derived: {
      builtAreaM2,
      neighborhood,
      priceToRentMultiplier,
      purchasePrice,
      communityFeesAnnual,
      preferredLtv,
      holdingYears,
    },
  };
}

/** equityRequired as the engine computed it for this case, the coverage factor drawn for it, and the resulting equityAvailable (= totalBudget, conceptually - see deriveSyntheticEquitySupply()). */
export interface SyntheticEquitySupply {
  equityRequired: number;
  equityCoverage: number;
  equityAvailable: number;
}

/**
 * Derives available equity - and, by the same logic, totalBudget - from
 * THIS case's own equityRequired, the figure the engine has already
 * computed for it (acquisition.equityRequired: financing shortfall +
 * acquisition taxes/fees + renovation cost, all specific to this case).
 *
 * A coverage factor of 0.6-1.4 (TSG_SCORE_DISTRIBUTION_EQUITY_COVERAGE_RANGE)
 * simulates a spread from under-prepared to well-prepared investors
 * relative to what THIS deal needs - not, as an earlier draft had it, a
 * fraction of purchase price, which ignored how much a given deal's own
 * leverage and costs actually demand and left nearly every generated case
 * short.
 *
 * Can only run after runEngine() has produced this case's equityRequired,
 * which is why it is a separate step from buildSyntheticEngineInput()
 * rather than folded into it.
 */
export function deriveSyntheticEquitySupply(
  rng: () => number,
  equityRequired: number,
): SyntheticEquitySupply {
  const range = TSG_SCORE_DISTRIBUTION_EQUITY_COVERAGE_RANGE.value;
  const equityCoverage = uniform(rng, range.min, range.max);
  return { equityRequired, equityCoverage, equityAvailable: equityRequired * equityCoverage };
}

/**
 * Builds one synthetic case and scores it, returning only the total
 * (SCORE_SPEC.md §5: "reken elke casus door en bewaar alleen de
 * totaalscore"). Returns null on the rare case where the ten-year
 * cashflow series never changes sign (no defined IRR) - not a plausible
 * outcome for these ranges, but resolved by omitting the case rather than
 * fabricating a score for an undefined return.
 */
function scoreOneCase(rng: () => number): number | null {
  const { input, derived } = buildSyntheticEngineInput(rng);
  const { purchasePrice, holdingYears } = derived;
  const { rentalStrategy, renovationStrategy } = input.selections;

  const engineResult = runEngine(input);
  const scenarioResult = engineResult.scenarios.find((s) => s.id === "base")!;

  // Only knowable once the engine has computed this case's own
  // equityRequired - see deriveSyntheticEquitySupply()'s docstring.
  const equity = deriveSyntheticEquitySupply(rng, engineResult.acquisition.equityRequired);
  const equityAvailable = equity.equityAvailable;

  const years = buildProjectionYears({
    years: holdingYears,
    scenario: "base",
    scenarioResult,
    purchasePrice,
    financing: engineResult.selectedFinancing,
    fixedCosts: engineResult.fixedOperatingCosts,
    euResident: true,
    renovation: engineResult.selectedRenovation,
  });

  const exit = computeExit({
    scenario: "base",
    years,
    purchasePrice,
    acquisition: engineResult.acquisition,
    renovation: engineResult.selectedRenovation,
    assumptions: TSG_SCORE_DISTRIBUTION_EXIT_ASSUMPTIONS.value,
  });

  const irr = computeScenarioIrr({
    equityInvested: engineResult.acquisition.equityRequired,
    years,
    exit,
  });
  if (!irr.defined) return null;

  // Deliberately WITHOUT scenarioCashflow/maxRenovationBudget/renovationCost,
  // so this outcome's own `score`/`percentile` stay null and the score is
  // computed directly below instead. buildScenarioOutcome() resolves
  // `percentile` against the COMMITTED reference-distribution.json
  // (distribution/load.ts) - reading that here would make generating the
  // distribution depend on the previous distribution, and would break
  // outright on a from-scratch regeneration with no JSON present.
  // The generator must not consume its own output.
  //
  // The cost of that separation is two code paths computing the same
  // score; distribution.test.ts pins them to identical results so they
  // cannot drift apart silently.
  const outcome = buildScenarioOutcome({
    scenario: "base",
    purchasePrice,
    years,
    exit,
    irr,
    equityRequired: engineResult.acquisition.equityRequired,
    equityAvailable,
    minRequiredReturn: input.constraints.minRoiTarget,
    rentalStrategy,
    renovationStrategy,
  });

  const score = computeTsgScore({
    monthlyCashflow: scenarioResult.monthlyCashflow,
    dscr: scenarioResult.dscr,
    irr: irr.irr,
    minRequiredReturn: outcome.returnRequirement.minRequiredReturn,
    placeholderCount: outcome.placeholdersUsed.length,
    feasibility: {
      equityRequired: engineResult.acquisition.equityRequired,
      equityAvailable,
      maxRenovationBudget: input.constraints.maxRenovationBudget,
      renovationCost: engineResult.selectedRenovation.capex,
    },
  });

  return score.total;
}

/**
 * Generates the synthetic reference distribution (SCORE_SPEC.md §5).
 * Deterministic: the same seed always yields the same sorted scores.
 *
 * `size` and `seed` default to TSG_SCORE_DISTRIBUTION_SAMPLE_SIZE (1.000)
 * and TSG_SCORE_DISTRIBUTION_SEED; overriding them (a smaller `size` for a
 * fast test, say) is supported for exactly that, not for production use.
 */
export function generateReferenceDistribution(options?: {
  size?: number;
  seed?: number;
}): ScoreDistribution {
  const size = options?.size ?? TSG_SCORE_DISTRIBUTION_SAMPLE_SIZE.value;
  const seed = options?.seed ?? TSG_SCORE_DISTRIBUTION_SEED.value;
  const rng = createRng(seed);

  const scores: number[] = [];
  // A bounded retry budget, not an unbounded loop: scoreOneCase() returning
  // null is expected to be effectively impossible for these ranges (see
  // its docstring); this cap turns a hypothetical systemic failure into an
  // error instead of a silent infinite loop.
  const maxAttempts = size * 10;
  let attempts = 0;
  while (scores.length < size && attempts < maxAttempts) {
    attempts++;
    const score = scoreOneCase(rng);
    if (score !== null) scores.push(score);
  }
  if (scores.length < size) {
    throw new Error(
      `generateReferenceDistribution could not collect ${size} valid cases within ${maxAttempts} attempts (got ${scores.length})`,
    );
  }

  scores.sort((a, b) => a - b);
  return { scores, size, generatedAt: new Date().toISOString(), seed };
}
