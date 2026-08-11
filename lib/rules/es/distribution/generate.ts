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
  TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_ANNUAL,
  TSG_SCORE_DISTRIBUTION_CONSTRAINTS,
  TSG_SCORE_DISTRIBUTION_EQUITY_RATIO_RANGE,
  TSG_SCORE_DISTRIBUTION_EXIT_ASSUMPTIONS,
  TSG_SCORE_DISTRIBUTION_PURCHASE_PRICE_RANGE,
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

/**
 * Builds one synthetic EngineInput (SCORE_SPEC.md §5's bullet list) and
 * scores it, returning only the total (SCORE_SPEC.md §5: "reken elke
 * casus door en bewaar alleen de totaalscore").
 *
 * Every generated case sets hasTouristRentalLicense: true. §5's rental
 * mix includes a 30% "hybrid" share, which MODEL_SPEC.md §18 rejects
 * without a valid título habilitante; §5 does not vary license status, so
 * fixing it to true (rather than drawing it and then rejecting/reweighting
 * hybrid draws) is the same "defaults uit parameters.ts" treatment §5
 * already applies to community fees, exit assumptions and constraints.
 *
 * Returns null on the rare case where the ten-year cashflow series never
 * changes sign (no defined IRR) - not a plausible outcome for these
 * ranges, but resolved by omitting the case rather than fabricating a
 * score for an undefined return.
 */
function scoreOneCase(rng: () => number): number | null {
  const priceRange = TSG_SCORE_DISTRIBUTION_PURCHASE_PRICE_RANGE.value;
  const priceSteps = Math.round((priceRange.max - priceRange.min) / priceRange.step) + 1;
  const purchasePrice = priceRange.min + pickIndex(rng, priceSteps) * priceRange.step;

  const areaRange = TSG_SCORE_DISTRIBUTION_AREA_RANGE_M2.value;
  const builtAreaM2 = uniform(rng, areaRange.min, areaRange.max);

  const neighborhoods = Object.keys(NEIGHBORHOOD_RENT_LONG_TERM.value);
  const neighborhood = pick(rng, neighborhoods);

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
      communityFeesAnnual: TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_ANNUAL.value,
      hasTouristRentalLicense: true,
    },
    constraints: {
      totalBudget: constraints.totalBudget,
      maxRenovationBudget: constraints.maxRenovationBudget,
      minLtv: constraints.minLtv,
      maxLtv: constraints.maxLtv,
      minRoiTarget: constraints.minRoiTarget,
      minMonthlyCashflow: constraints.minMonthlyCashflow,
      maxMonthlyDebt: constraints.maxMonthlyDebt,
    },
    selections: {
      rentPerM2LongTerm: NEIGHBORHOOD_RENT_LONG_TERM.value[neighborhood]!,
      rentPerM2ShortTerm: NEIGHBORHOOD_RENT_SHORT_TERM.value[neighborhood]!,
      rentalStrategy,
      renovationStrategy,
      financingStrategy,
      residency: "nonResident",
      euResident: true,
    },
  };

  const engineResult = runEngine(input);
  const scenarioResult = engineResult.scenarios.find((s) => s.id === "base")!;

  const equityRatioRange = TSG_SCORE_DISTRIBUTION_EQUITY_RATIO_RANGE.value;
  const equityAvailable =
    engineResult.acquisition.equityRequired *
    uniform(rng, equityRatioRange.min, equityRatioRange.max);

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
