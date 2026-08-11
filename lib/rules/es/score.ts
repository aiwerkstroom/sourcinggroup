/**
 * TSG score (SCORE_SPEC.md §1-§3): five dimensions, each a monotone
 * mapping from one engine outcome onto a 0-10 scale, plus their weighted
 * total.
 *
 * The mappings are piecewise linear rather than sigmoid or logistic, and
 * SCORE_SPEC.md §2 gives the reason: a customer must be able to see with a
 * ruler why they got a 6. A logistic curve hides a steepness and a
 * midpoint the report would then either have to publish or conceal;
 * straight segments between published anchor points hide nothing, and an
 * anchor can be nudged without dragging the rest of the curve with it.
 *
 * Every number this module scores with lives in parameters.ts as an
 * ESTIMATE (TSG_SCORE_*), never inline here - the same house rule the rest
 * of the calculation layer follows.
 *
 * Placement note: SCORE_SPEC.md §6 writes the file as /lib/score.ts. It
 * sits here in lib/rules/es/ instead, next to the engine it scores,
 * because the spec's own header calls the score "een engine-onderdeel" and
 * every module it reads from (outcome.ts, scenarios.ts, irr.ts) lives
 * here. The file split the spec asks for - score / percentile /
 * distribution.generate - is preserved exactly.
 */

import {
  TSG_SCORE_ANCHORS_CASHFLOW,
  TSG_SCORE_ANCHORS_DATA_CERTAINTY,
  TSG_SCORE_ANCHORS_DEBT_RESILIENCE,
  TSG_SCORE_ANCHORS_RETURN_VS_REQUIREMENT,
  TSG_SCORE_DIMENSION_WEIGHTS,
  TSG_SCORE_FEASIBILITY_LEVELS,
  TSG_SCORE_FEASIBILITY_MARGIN_THRESHOLD,
} from "./parameters";
import type {
  ScoreAnchor,
  TsgDimensionScores,
  TsgScore,
  TsgScoreDimension,
} from "./types";

/**
 * Interpolates a 0-10 score from a piecewise-linear anchor curve
 * (SCORE_SPEC.md §2).
 *
 * Outside the outermost anchors the score is clamped to that anchor's own
 * score, not to a fixed 0 and 10. The spec phrases the rule as "onder het
 * laagste ankerpunt: 0, boven het hoogste: 10", which holds for the four
 * ascending curves; clamping to the endpoint value states the same rule in
 * a form that also covers the deliberately descending data-certainty curve
 * (§2.5), where the lowest anchor scores 10 and the highest 0.
 *
 * Throws rather than guesses on a malformed curve or a non-finite input: a
 * silently wrong score is worse than a crash, since nothing downstream
 * could detect it.
 */
export function piecewiseLinear(anchors: readonly ScoreAnchor[], x: number): number {
  if (anchors.length < 2) {
    throw new Error("piecewiseLinear needs at least two anchors");
  }
  for (let i = 1; i < anchors.length; i++) {
    if (anchors[i]!.x <= anchors[i - 1]!.x) {
      throw new Error(
        `piecewiseLinear anchors must be strictly ascending in x (index ${i}: ${anchors[i - 1]!.x} -> ${anchors[i]!.x})`,
      );
    }
  }
  if (!Number.isFinite(x)) {
    throw new Error(`piecewiseLinear cannot score a non-finite value (${x})`);
  }

  const first = anchors[0]!;
  const last = anchors[anchors.length - 1]!;
  if (x <= first.x) return first.score;
  if (x >= last.x) return last.score;

  for (let i = 1; i < anchors.length; i++) {
    const hi = anchors[i]!;
    if (x <= hi.x) {
      const lo = anchors[i - 1]!;
      const t = (x - lo.x) / (hi.x - lo.x);
      return lo.score + t * (hi.score - lo.score);
    }
  }
  /* c8 ignore next 2 -- unreachable: x < last.x was handled by the clamp above. */
  return last.score;
}

/** Rounds a score to the one decimal SCORE_SPEC.md §1 defines it to carry. */
export function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Cashflow dimension (SCORE_SPEC.md §2.1), from the base scenario's monthly cashflow in €. */
export function cashflowScore(monthlyCashflow: number): number {
  return roundScore(piecewiseLinear(TSG_SCORE_ANCHORS_CASHFLOW.value, monthlyCashflow));
}

/** Debt resilience dimension (SCORE_SPEC.md §2.2), from the base scenario's DSCR. */
export function debtResilienceScore(dscr: number): number {
  return roundScore(piecewiseLinear(TSG_SCORE_ANCHORS_DEBT_RESILIENCE.value, dscr));
}

/**
 * Return dimension (SCORE_SPEC.md §2.3). Takes the IRR and the required
 * return as fractions (0.0554 and 0.04, the units the engine carries them
 * in) and converts to the percentage points the curve is defined over, so
 * a caller cannot accidentally feed one unit where the other is meant.
 */
export function returnVsRequirementScore(irr: number, minRequiredReturn: number): number {
  const surplusPercentagePoints = (irr - minRequiredReturn) * 100;
  return roundScore(
    piecewiseLinear(TSG_SCORE_ANCHORS_RETURN_VS_REQUIREMENT.value, surplusPercentagePoints),
  );
}

/** Data certainty dimension (SCORE_SPEC.md §2.5), from the number of PLACEHOLDER parameters the outcome rests on. */
export function dataCertaintyScore(placeholderCount: number): number {
  if (!Number.isInteger(placeholderCount) || placeholderCount < 0) {
    throw new Error(
      `dataCertaintyScore needs a non-negative whole count of placeholders, got ${placeholderCount}`,
    );
  }
  return roundScore(piecewiseLinear(TSG_SCORE_ANCHORS_DATA_CERTAINTY.value, placeholderCount));
}

/**
 * The two binary checks the feasibility dimension reads (SCORE_SPEC.md
 * §2.4). Either check can be absent - "waar een van beide inputs
 * ontbreekt, wordt die toets overgeslagen en geldt de andere" - which is
 * why both are optional here rather than defaulted to something
 * permissive: a missing input must not silently read as a passed check.
 */
export interface FeasibilityInput {
  equityRequired: number;
  /** PropertyInput.ownMoney. Undefined skips the equity check entirely. */
  equityAvailable?: number;
  /** InvestorConstraints.maxRenovationBudget. Undefined (or a missing renovationCost) skips the budget check. */
  maxRenovationBudget?: number;
  /** The selected renovation strategy's capex. */
  renovationCost?: number;
}

/**
 * Feasibility dimension (SCORE_SPEC.md §2.4) - the one dimension that is a
 * ladder rather than a curve.
 *
 * The margin is min(equity headroom, budget headroom) / equityRequired,
 * exactly as the spec writes it: both headrooms are measured against the
 * equity requirement, including the renovation-budget one. That is the
 * spec's literal formula and it is deliberate - it asks "how much room is
 * there, relative to the money this deal ties up", not "how much room is
 * there relative to each separate limit".
 *
 * Throws when neither check can run: with both inputs absent there is
 * nothing to be feasible or infeasible about, and any number returned
 * would be invented.
 */
export function feasibilityScore(input: FeasibilityInput): number {
  const levels = TSG_SCORE_FEASIBILITY_LEVELS.value;

  const equityHeadroom =
    input.equityAvailable === undefined ? undefined : input.equityAvailable - input.equityRequired;
  const budgetHeadroom =
    input.maxRenovationBudget === undefined || input.renovationCost === undefined
      ? undefined
      : input.maxRenovationBudget - input.renovationCost;

  if (equityHeadroom === undefined && budgetHeadroom === undefined) {
    throw new Error(
      "feasibilityScore needs at least one of the two checks: equityAvailable, or maxRenovationBudget + renovationCost",
    );
  }

  const equityFails = equityHeadroom !== undefined && equityHeadroom < 0;
  const budgetFails = budgetHeadroom !== undefined && budgetHeadroom < 0;

  if (equityFails && budgetFails) return levels.bothChecksFail;
  if (equityFails || budgetFails) return levels.oneCheckFails;

  const headrooms = [equityHeadroom, budgetHeadroom].filter(
    (h): h is number => h !== undefined,
  );
  const smallestHeadroom = Math.min(...headrooms);

  // A deal requiring no equity at all has no denominator for a relative
  // margin. SCORE_SPEC.md does not address it (in practice the acquisition
  // taxes and fees keep equityRequired above zero); treating a deal that
  // needs nothing and stayed within budget as ample headroom is the
  // boundary convention chosen here, stated rather than hidden in a NaN.
  if (input.equityRequired <= 0) return levels.bothPassAmpleMargin;

  const margin = smallestHeadroom / input.equityRequired;
  return margin >= TSG_SCORE_FEASIBILITY_MARGIN_THRESHOLD.value
    ? levels.bothPassAmpleMargin
    : levels.bothPassNarrowMargin;
}

/**
 * Weighted total (SCORE_SPEC.md §3), computed from the already-rounded
 * dimension scores so that the arithmetic in the report reproduces the
 * published total exactly - the way §4's worked example does it.
 */
export function totalScore(dimensions: TsgDimensionScores): number {
  const weights = TSG_SCORE_DIMENSION_WEIGHTS.value;
  let sum = 0;
  for (const dimension of Object.keys(weights) as TsgScoreDimension[]) {
    sum += dimensions[dimension] * weights[dimension];
  }
  return roundScore(sum);
}

/** Everything the five dimensions need, gathered from one scenario's engine outcome. */
export interface TsgScoreInput {
  /** ScenarioResult.monthlyCashflow of the scenario being scored. */
  monthlyCashflow: number;
  /** ScenarioResult.dscr of the scenario being scored. */
  dscr: number;
  /** IrrResult.irr as a fraction. */
  irr: number;
  /** ReturnRequirementCheck.minRequiredReturn as a fraction. */
  minRequiredReturn: number;
  /** ScenarioOutcome.placeholdersUsed.length. */
  placeholderCount: number;
  feasibility: FeasibilityInput;
}

/** The full five-dimension score plus its weighted total (SCORE_SPEC.md §1-§3). */
export function computeTsgScore(input: TsgScoreInput): TsgScore {
  const dimensions: TsgDimensionScores = {
    cashflow: cashflowScore(input.monthlyCashflow),
    debtResilience: debtResilienceScore(input.dscr),
    returnVsRequirement: returnVsRequirementScore(input.irr, input.minRequiredReturn),
    feasibility: feasibilityScore(input.feasibility),
    dataCertainty: dataCertaintyScore(input.placeholderCount),
  };
  return { dimensions, total: totalScore(dimensions) };
}
