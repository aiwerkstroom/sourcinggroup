/**
 * Percentile lookup against the synthetic reference distribution
 * (SCORE_SPEC.md §5): where one TSG total score falls among the 1.000
 * scores in a ScoreDistribution.
 *
 * This module only searches a ScoreDistribution value it is handed - it
 * never generates one (that is distribution/generate.ts) and never reads
 * or writes a file itself, keeping it a pure calculation-layer module like
 * the rest of lib/rules/es/. parseScoreDistribution/serializeScoreDistribution
 * below are the "laden" (load) half SCORE_SPEC.md §6 asks for: turning the
 * JSON text a caller obtained however it likes (a bundled asset, a fetch,
 * a file read) into a validated ScoreDistribution and back.
 */

import type { ScoreDistribution } from "./types";

/**
 * Count of scores in the ascending array strictly less than `x`, via
 * binary search (the array can hold 1.000+ entries; O(log n) instead of a
 * linear scan). This is the "lower bound" index: the first position where
 * `x` could be inserted while keeping the array sorted.
 */
function countStrictlyBelow(sortedScores: readonly number[], x: number): number {
  let lo = 0;
  let hi = sortedScores.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sortedScores[mid]! < x) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/**
 * The percentile of `score` within `distribution` (SCORE_SPEC.md §5):
 * "het percentage casussen in de referentieverdeling met een lagere
 * totaalscore" - the share of the reference distribution strictly below
 * this score, as a whole number 0-99 (§1). 100 is deliberately
 * unreachable: a score at or above every synthetic case still reports 99,
 * the top bucket, rather than a 100th percentile the §1 range excludes.
 *
 * Throws on an empty distribution: no percentage is a percentage of zero
 * cases.
 */
export function computePercentile(distribution: ScoreDistribution, score: number): number {
  if (distribution.scores.length === 0) {
    throw new Error("computePercentile needs a non-empty distribution");
  }
  if (!Number.isFinite(score)) {
    throw new Error(`computePercentile cannot place a non-finite score (${score})`);
  }
  const below = countStrictlyBelow(distribution.scores, score);
  const raw = Math.floor((below / distribution.scores.length) * 100);
  return Math.min(99, Math.max(0, raw));
}

/**
 * Validates a value as a well-formed ScoreDistribution: ascending scores,
 * a length matching `size`, and every score within the 0-10 range SCORE_SPEC.md
 * §1 defines a total score to have. Used by parseScoreDistribution and
 * exposed directly so a caller who already has a parsed object (rather
 * than JSON text) can still validate it before trusting it.
 */
export function assertValidScoreDistribution(
  distribution: ScoreDistribution,
): asserts distribution is ScoreDistribution {
  if (distribution.scores.length !== distribution.size) {
    throw new Error(
      `ScoreDistribution.size (${distribution.size}) does not match scores.length (${distribution.scores.length})`,
    );
  }
  for (let i = 0; i < distribution.scores.length; i++) {
    const s = distribution.scores[i]!;
    if (!Number.isFinite(s) || s < 0 || s > 10) {
      throw new Error(`ScoreDistribution.scores[${i}] is out of the 0-10 range: ${s}`);
    }
    if (i > 0 && s < distribution.scores[i - 1]!) {
      throw new Error(
        `ScoreDistribution.scores must be ascending (index ${i}: ${distribution.scores[i - 1]} -> ${s})`,
      );
    }
  }
}

/** Parses and validates a ScoreDistribution from JSON text (SCORE_SPEC.md §6: "laden ... van de referentieverdeling"). */
export function parseScoreDistribution(json: string): ScoreDistribution {
  const parsed = JSON.parse(json) as ScoreDistribution;
  assertValidScoreDistribution(parsed);
  return parsed;
}

/** Serializes a ScoreDistribution to the JSON text distribution/generate.ts's output is meant to be stored as (SCORE_SPEC.md §6). */
export function serializeScoreDistribution(distribution: ScoreDistribution): string {
  return JSON.stringify(distribution);
}
