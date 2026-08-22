/**
 * The free indication's score (SCORE_SPEC.md §8).
 *
 * Two dimensions, not five. Without investor input there is no DSCR, no
 * IRR and no equity requirement, so §2.2, §2.3 and §2.4 have nothing to
 * read - and §8.1 is explicit that the two survivors are not re-weighted
 * to compensate. An indication built on two dimensions does not claim to
 * measure what the paid score measures; it claims less.
 *
 * This is its own small function rather than computeTsgScore() with three
 * arguments left out, for the same reason band.ts is not runEngine() with
 * fields left out (CLAUDE.md §6). What it does reuse is the scoring
 * itself: cashflowScore() and dataCertaintyScore() from score.ts, on the
 * same §2.1 and §2.5 anchor curves the paid report scores with. The two
 * paths cannot drift, because there is only one curve.
 *
 * What is new here is only the grading. SCORE_SPEC.md §8.2 replaces the
 * 0-10 number with Laag/Gemiddeld/Hoog so that nobody sets an indication
 * beside a paid TSG score and reads two numbers as one measurement, and
 * the underlying scores are "nergens getoond". IndicativeScore therefore
 * does not carry them at all - a page cannot render what it was never
 * given.
 */

import {
  FREE_TIER_INDICATIVE_LABEL_THRESHOLDS,
} from "../parameters";
import { cashflowScore, dataCertaintyScore } from "../score";
import type { FreeTierBand, IndicativeLabel, IndicativeScore } from "../types";

/**
 * SCORE_SPEC.md §8.3's scope disclosure, which is unconditional whenever
 * an indicative score is shown. Additive to the band's own five keys -
 * those describe the figure, this one describes what the score does and
 * does not take into account.
 */
export const INDICATIVE_SCORE_DISCLOSURE_KEYS = ["indicativeScoreScope"] as const;

/**
 * Grades one 0-10 score against one of the two cut-off pairs
 * (SCORE_SPEC.md §8.2). Takes the score already rounded to the single
 * decimal §1 defines it to carry, because that is the number the spec's
 * own table is written over: its bands read "0,0-3,9 / 4,0-6,9 /
 * 7,0-10,0", i.e. boundaries between one-decimal values, not between raw
 * interpolations. cashflowScore() and dataCertaintyScore() both round
 * before returning, so callers below get this for free.
 *
 * Two pairs, not one, since fase A stap 4 split
 * FREE_TIER_INDICATIVE_LABEL_THRESHOLDS into a cashflow pair and a
 * dataConfidence pair - see that parameter's own docstring for why
 * sharing one pair between the two curves stopped being safe once fase A
 * stap 3 added financing to the cashflow figure, and for the full
 * derivation of each pair's current values (dataConfidence: unchanged,
 * still the break-even-aligned 4.0/7.0 this parameter started with;
 * cashflow: recalibrated against a representative grid of free-tier
 * inputs, since financing pushed most of that grid onto §2.1's own floor).
 */
export function toIndicativeLabel(
  score: number,
  thresholds: { medium: number; high: number },
): IndicativeLabel {
  if (score >= thresholds.high) return "high";
  if (score >= thresholds.medium) return "medium";
  return "low";
}

/**
 * The indicative score for one free-tier band (SCORE_SPEC.md §8).
 *
 * Both inputs come from the band rather than being recomputed: the
 * cashflow dimension reads the midpoint of the two ends, and the data
 * confidence dimension counts the band's own placeholdersUsed. Counting
 * that list rather than re-deriving it is what keeps the score honest
 * about this specific figure - if the band ever rests on more or fewer
 * unverified assumptions, the score moves with it automatically.
 */
export function computeIndicativeScore(band: FreeTierBand): IndicativeScore {
  const { low, high } = band.monthlyCashflow;
  const midpoint = (low + high) / 2;
  const thresholds = FREE_TIER_INDICATIVE_LABEL_THRESHOLDS.value;

  return {
    cashflowLabel: toIndicativeLabel(cashflowScore(midpoint), thresholds.cashflow),
    dataConfidenceLabel: toIndicativeLabel(
      dataCertaintyScore(band.placeholdersUsed.length),
      thresholds.dataConfidence,
    ),
    disclosures: INDICATIVE_SCORE_DISCLOSURE_KEYS,
  };
}
