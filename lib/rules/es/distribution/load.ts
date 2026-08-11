/**
 * Loads the committed reference distribution (SCORE_SPEC.md §5/§6): the
 * "laden" half of what §6 asks percentile.ts to do, kept out of
 * percentile.ts itself so that module can stay a pure calculation-layer
 * file with no file I/O (see its own docstring).
 *
 * reference-distribution.json is a one-time, committed artifact -
 * SCORE_SPEC.md §6: "generatie van de synthetische set (eenmalig, uitkomst
 * opslaan als JSON)" - produced by calling generateReferenceDistribution()
 * and serializeScoreDistribution() once, not regenerated on every call
 * this module makes. buildScenarioOutcome() (outcome.ts) calls
 * loadReferenceDistribution() to compute ScenarioOutcome.percentile; doing
 * that by re-running generateReferenceDistribution() (1.000 full engine
 * runs) on every single outcome built would be both wasteful and
 * pointless, since nothing about one outcome's own numbers should change
 * what the reference universe looks like.
 *
 * SCORE_SPEC.md §5's "Verversing" rule lists when this file must be
 * regenerated: parameters.ts changes, the scoring curves/weights change,
 * or the crawl has enough real cases to replace the synthetic set. There
 * is currently no automated regeneration step - regenerate by calling
 * generateReferenceDistribution() and serializeScoreDistribution() and
 * overwriting this file, the same way it was first produced.
 *
 * resolveJsonModule (tsconfig.json) makes this a plain, statically
 * type-checked import - Node's and Vite's module systems already load and
 * parse a given JSON module only once, no matter how many files import it;
 * the module-level cache below additionally avoids re-running
 * assertValidScoreDistribution() (an O(n) scan over 1.000 scores) on every
 * call, not the load itself.
 */

import { assertValidScoreDistribution } from "../percentile";
import type { ScoreDistribution } from "../types";
import referenceDistributionJson from "./reference-distribution.json";

let cached: ScoreDistribution | undefined;

/** The committed reference distribution, validated once and cached thereafter. */
export function loadReferenceDistribution(): ScoreDistribution {
  if (cached === undefined) {
    const distribution = referenceDistributionJson as ScoreDistribution;
    assertValidScoreDistribution(distribution);
    cached = distribution;
  }
  return cached;
}
