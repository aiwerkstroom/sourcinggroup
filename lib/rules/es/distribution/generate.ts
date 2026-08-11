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
  PROJECTION_YEARS,
  RENOVATION_STRATEGIES,
  TSG_SCORE_DISTRIBUTION_AREA_RANGE_M2,
  TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_RANGE,
  TSG_SCORE_DISTRIBUTION_CONSTRAINTS,
  TSG_SCORE_DISTRIBUTION_EQUITY_TO_PRICE_RATIO_RANGE,
  TSG_SCORE_DISTRIBUTION_EXIT_ASSUMPTIONS,
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

/** builtAreaM2, purchasePrice and communityFeesAnnual as buildSyntheticEngineInput() derived them, exposed for tests that check the derivation itself rather than only its downstream score. */
export interface SyntheticCaseDerivedFigures {
  builtAreaM2: number;
  neighborhood: string;
  priceToRentMultiplier: number;
  purchasePrice: number;
  equityToPriceRatio: number;
  equityAvailable: number;
  communityFeesAnnual: number;
}

/**
 * Builds one synthetic EngineInput (SCORE_SPEC.md §5's bullet list,
 * corrected per Samuel's review of the first draft):
 *
 * 1. Purchase price is no longer drawn independently of floor area - it is
 *    derived from the neighborhood's own rent table (price = annual rent
 *    per m² x a price-to-rent multiplier x builtAreaM2), so a case's price
 *    and area are no longer free to combine into an implausible pairing
 *    (a huge cheap unit, a tiny expensive one).
 * 2. Available equity (and totalBudget, which tracks the same draw) is a
 *    fraction of THIS case's purchase price, not of its own computed
 *    equityRequired - the previous design made feasibility
 *    near-tautological by comparing equityRequired to a fraction of
 *    itself.
 * 3. Gastos de comunidad is drawn from a range per case, not fixed at
 *    € 900 for every one regardless of the building.
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
 * the part the three corrections above changed - can be unit-tested
 * directly against the figures it derived, not only indirectly through a
 * final score.
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

  // Available equity - and, via the same draw, totalBudget - as a share of
  // THIS case's own purchase price, known before the engine even runs.
  const equityRatioRange = TSG_SCORE_DISTRIBUTION_EQUITY_TO_PRICE_RATIO_RANGE.value;
  const equityToPriceRatio = uniform(rng, equityRatioRange.min, equityRatioRange.max);
  const equityAvailable = purchasePrice * equityToPriceRatio;
  const totalBudget = equityAvailable;

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
      totalBudget,
      maxRenovationBudget: constraints.maxRenovationBudget,
      minLtv: constraints.minLtv,
      maxLtv: constraints.maxLtv,
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
      equityToPriceRatio,
      equityAvailable,
      communityFeesAnnual,
    },
  };
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
  const { purchasePrice, equityAvailable } = derived;
  const { constraints, selections } = input;
  const { rentalStrategy, renovationStrategy } = selections;

  const engineResult = runEngine(input);
  const scenarioResult = engineResult.scenarios.find((s) => s.id === "base")!;

  const years = buildProjectionYears({
    years: PROJECTION_YEARS.value,
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

  const outcome = buildScenarioOutcome({
    scenario: "base",
    purchasePrice,
    years,
    exit,
    irr,
    equityRequired: engineResult.acquisition.equityRequired,
    equityAvailable,
    minRequiredReturn: constraints.minRoiTarget,
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
      maxRenovationBudget: constraints.maxRenovationBudget,
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
