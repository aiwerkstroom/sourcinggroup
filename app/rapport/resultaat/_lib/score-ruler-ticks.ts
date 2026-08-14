/**
 * Where the tick-marks sit on each dimension's 0-10 ruler
 * (DESIGN_SPEC.md §4: "Tick-marks bij de §2-ankerpunten van SCORE_SPEC").
 *
 * These are the *score* positions of SCORE_SPEC §2's anchors, not the input
 * values those anchors are defined over. The distinction matters and is the
 * whole reason this file is safe to ship: the anchor for "cashflow of
 * € 250/month" scores 6, and what the ruler shows is the 6 - never the
 * € 250. The reader sees where the model's grading changes slope, which is
 * exactly what §4 asks the ruler to communicate, without the input
 * thresholds that would let the curve be reconstructed.
 *
 * Deliberately declared here as literal display data rather than imported
 * from parameters.ts, and the reason is the same standing rule the rest of
 * this app follows: the paid report renders inside a client component
 * (resultaat-view.tsx), so anything it imports reaches the browser bundle -
 * and parameters.ts carries TSG_SCORE_DIMENSION_WEIGHTS, which UI_SPEC.md
 * §5 says is never published. Importing the anchors here to "stay in sync"
 * would drag that whole module along with them. The same split
 * rent-provenance-key.ts already documents.
 *
 * Duplication without drift: score-ruler-ticks.test.ts imports the real
 * parameters (it runs in Node, not the browser) and asserts every list
 * below still equals the sorted, de-duplicated score values of its anchor
 * set. Change an anchor and that test fails; it cannot silently diverge.
 *
 * Feasibility is the one dimension without a continuous curve - SCORE_SPEC
 * §2.4's own point, that a deal which cannot be financed is not partially
 * financeable. Its four ticks are the four discrete levels it can take, so
 * the ruler reads as four stops rather than a slope. That is a truthful
 * picture of the dimension, not a simplification of it.
 */

import type { TsgScoreDimension } from "@/lib/rules/es/types";

export const SCORE_RULER_TICKS: Readonly<Record<TsgScoreDimension, readonly number[]>> = {
  cashflow: [0, 2, 4, 6, 7.5, 9, 10],
  debtResilience: [0, 2.5, 5, 7, 8.5, 10],
  returnVsRequirement: [0, 2, 5, 7, 8.5, 10],
  feasibility: [0, 3, 7, 10],
  dataCertainty: [0, 2, 4, 6, 8, 10],
};

/** The scale every ruler is drawn over (SCORE_SPEC.md §1: each dimension is 0-10). */
export const SCORE_RULER_MIN = 0;
export const SCORE_RULER_MAX = 10;
