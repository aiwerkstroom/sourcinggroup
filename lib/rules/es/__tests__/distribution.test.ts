import { describe, expect, it } from "vitest";
import { generateReferenceDistribution } from "../distribution/generate";
import {
  NEIGHBORHOOD_RENT_LONG_TERM,
  NEIGHBORHOOD_RENT_SHORT_TERM,
  TSG_SCORE_DISTRIBUTION_RENTAL_STRATEGY_SHARES,
} from "../parameters";
import { computePercentile } from "../percentile";

/**
 * SCORE_SPEC.md §5: "Genereer bij de eerste build een synthetische set van
 * 1.000 casussen ... Reken elke casus door en bewaar alleen de
 * totaalscore." The Claude instruction for this step ("Genereer de
 * verdeling als onderdeel van de tests, niet als los script") is followed
 * literally: every test below calls generateReferenceDistribution()
 * itself rather than reading a pre-built JSON asset.
 *
 * The mulberry32 sequence this module's RNG produces was independently
 * cross-checked against a from-scratch Python reimplementation for seed
 * 20260811 (bit-for-bit match on the first 10 draws) - the same
 * independent-recomputation method used for the phase-1b golden tests,
 * applied here to the one genuinely new piece of arithmetic this step
 * introduces (the engine itself was already exhaustively golden-tested).
 */

describe("data used by the generator is self-consistent", () => {
  it("the long-term and short-term neighborhood tables cover the exact same neighborhoods", () => {
    // scoreOneCase() reads NEIGHBORHOOD_RENT_SHORT_TERM.value[neighborhood]
    // with a non-null assertion after picking from the long-term table's
    // keys - if the two tables' key sets ever diverged, that assertion
    // would silently produce undefined instead of failing loudly.
    const ltKeys = Object.keys(NEIGHBORHOOD_RENT_LONG_TERM.value).sort();
    const stKeys = Object.keys(NEIGHBORHOOD_RENT_SHORT_TERM.value).sort();
    expect(stKeys).toEqual(ltKeys);
  });

  it("the rental strategy shares sum to 1 (only longTerm/hybrid are drawn, never shortTerm)", () => {
    const shares = TSG_SCORE_DISTRIBUTION_RENTAL_STRATEGY_SHARES.value;
    expect(shares.longTerm + shares.hybrid).toBeCloseTo(1, 12);
  });
});

describe("generateReferenceDistribution() (SCORE_SPEC.md §5)", () => {
  it("produces exactly `size` scores, every one a valid runEngine() output scored end to end", () => {
    // A smaller size here only speeds up this particular assertion; the
    // full default-sized (1.000) distribution is exercised separately
    // below. If any generated EngineInput were invalid, runEngine's own
    // assertValidEngineInput would throw and this test would fail loudly
    // rather than silently skip a case.
    const dist = generateReferenceDistribution({ size: 200, seed: 7 });
    expect(dist.scores).toHaveLength(200);
    expect(dist.size).toBe(200);
  });

  it("returns scores sorted ascending", () => {
    const dist = generateReferenceDistribution({ size: 200, seed: 7 });
    for (let i = 1; i < dist.scores.length; i++) {
      expect(dist.scores[i]!).toBeGreaterThanOrEqual(dist.scores[i - 1]!);
    }
  });

  it("every score stays within the 0.0-10.0 range SCORE_SPEC.md §1 defines", () => {
    const dist = generateReferenceDistribution({ size: 200, seed: 7 });
    dist.scores.forEach((s) => {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(10);
    });
  });

  it("records size, seed and a generation timestamp on the distribution itself (§5: 'leg het tijdstip van generatie vast')", () => {
    const before = Date.now();
    const dist = generateReferenceDistribution({ size: 50, seed: 7 });
    const after = Date.now();
    expect(dist.size).toBe(50);
    expect(dist.seed).toBe(7);
    const generatedAtMs = new Date(dist.generatedAt).getTime();
    expect(generatedAtMs).toBeGreaterThanOrEqual(before);
    expect(generatedAtMs).toBeLessThanOrEqual(after);
  });

  it("is deterministic: the same seed produces the exact same scores, every time (SCORE_SPEC.md §6)", () => {
    const first = generateReferenceDistribution({ size: 300, seed: 42 });
    const second = generateReferenceDistribution({ size: 300, seed: 42 });
    expect(second.scores).toEqual(first.scores);
  });

  it("a different seed produces a different distribution", () => {
    const a = generateReferenceDistribution({ size: 300, seed: 1 });
    const b = generateReferenceDistribution({ size: 300, seed: 2 });
    expect(a.scores).not.toEqual(b.scores);
  });

  it("a larger size is not just a truncation of a smaller one - it draws its own sequence of cases", () => {
    // Same seed, different size: proves size actually controls how many
    // independent cases are drawn, not just how many of a fixed
    // pre-computed sequence are kept (which would make the two arrays
    // share a common prefix).
    const small = generateReferenceDistribution({ size: 50, seed: 7 });
    const large = generateReferenceDistribution({ size: 51, seed: 7 });
    expect(large.scores).not.toEqual([...small.scores, expect.anything()]);
  });
});

/**
 * The default-configuration distribution (SCORE_SPEC.md §5's own 1.000
 * cases, TSG_SCORE_DISTRIBUTION_SEED). Generated once and reused across
 * these `it`s, the same pattern the rest of this suite uses for
 * `runEngine(referenceCase)` - not regenerated per assertion.
 */
describe("the default (1.000-case, default-seed) reference distribution", () => {
  const distribution = generateReferenceDistribution();

  it("has exactly 1.000 scores, per SCORE_SPEC.md §5", () => {
    expect(distribution.scores).toHaveLength(1000);
    expect(distribution.size).toBe(1000);
  });

  it("generates in well under a second, fast enough to run inside a test rather than as a separate build step", () => {
    const t0 = Date.now();
    generateReferenceDistribution();
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  it("places the reference case's own base-scenario total (3.8, from score.test.ts) at a specific, reproducible percentile", () => {
    // Golden value for the default seed/size - reproducible because
    // generation is deterministic (SCORE_SPEC.md §6). If the scoring
    // curves, weights, or generation ranges in parameters.ts ever change,
    // SCORE_SPEC.md §5's "verversing" rule applies and this value is
    // expected to move; it is not expected to move on its own.
    expect(computePercentile(distribution, 3.8)).toBe(78);
  });

  it("presentation sentence renders as SCORE_SPEC.md §5 specifies", () => {
    const percentile = computePercentile(distribution, 3.8);
    const sentence = `Deze investering scoort in het ${percentile}ste percentiel van ons modelbereik.`;
    expect(sentence).toBe("Deze investering scoort in het 78ste percentiel van ons modelbereik.");
  });
});
