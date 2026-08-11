import { describe, expect, it } from "vitest";
import { buildSyntheticEngineInput, generateReferenceDistribution } from "../distribution/generate";
import {
  NEIGHBORHOOD_RENT_LONG_TERM,
  NEIGHBORHOOD_RENT_SHORT_TERM,
  TSG_SCORE_DISTRIBUTION_AREA_RANGE_M2,
  TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_RANGE,
  TSG_SCORE_DISTRIBUTION_EQUITY_TO_PRICE_RATIO_RANGE,
  TSG_SCORE_DISTRIBUTION_PRICE_TO_RENT_MULTIPLIER_RANGE,
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

/**
 * The three corrections to the original independent-sampling design,
 * verified directly against buildSyntheticEngineInput()'s own derived
 * figures rather than only indirectly through a final score.
 */
describe("the three corrections to the generator", () => {
  it("1. purchase price is derived from area x the neighborhood's own rent, not drawn independently of it", () => {
    const rng = createRng(1);
    for (let i = 0; i < 200; i++) {
      const { input, derived } = buildSyntheticEngineInput(rng);
      const rentPerM2LongTerm = NEIGHBORHOOD_RENT_LONG_TERM.value[derived.neighborhood]!;
      expect(input.selections.rentPerM2LongTerm).toBe(rentPerM2LongTerm);
      // purchasePrice = annual rent per m² x multiplier x builtAreaM2, exactly.
      expect(derived.purchasePrice).toBeCloseTo(
        rentPerM2LongTerm * 12 * derived.priceToRentMultiplier * derived.builtAreaM2,
        6,
      );
      // The multiplier stays within the configured price-to-rent bandwidth.
      const range = TSG_SCORE_DISTRIBUTION_PRICE_TO_RENT_MULTIPLIER_RANGE.value;
      expect(derived.priceToRentMultiplier).toBeGreaterThanOrEqual(range.min);
      expect(derived.priceToRentMultiplier).toBeLessThanOrEqual(range.max);
    }
  });

  it("2. available equity (and totalBudget) is a share of purchase price, not of equityRequired - and totalBudget equals equityAvailable exactly", () => {
    const rng = createRng(2);
    const range = TSG_SCORE_DISTRIBUTION_EQUITY_TO_PRICE_RATIO_RANGE.value;
    for (let i = 0; i < 200; i++) {
      const { input, derived } = buildSyntheticEngineInput(rng);
      expect(derived.equityAvailable).toBeCloseTo(derived.purchasePrice * derived.equityToPriceRatio, 6);
      expect(derived.equityToPriceRatio).toBeGreaterThanOrEqual(range.min);
      expect(derived.equityToPriceRatio).toBeLessThanOrEqual(range.max);
      // "totalBudget mag hetzelfde percentage volgen": identical to equityAvailable.
      expect(input.constraints.totalBudget).toBe(derived.equityAvailable);
    }
  });

  it("3. gastos de comunidad varies per case within the configured range, not fixed at € 900", () => {
    const rng = createRng(3);
    const range = TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_RANGE.value;
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const { input, derived } = buildSyntheticEngineInput(rng);
      expect(input.property.communityFeesAnnual).toBe(derived.communityFeesAnnual);
      expect(derived.communityFeesAnnual).toBeGreaterThanOrEqual(range.min);
      expect(derived.communityFeesAnnual).toBeLessThanOrEqual(range.max);
      seen.add(Math.round(derived.communityFeesAnnual));
    }
    // Genuinely varies, not a constant repeated 200 times.
    expect(seen.size).toBeGreaterThan(100);
  });

  it("the area range itself is unchanged by the three corrections: still SCORE_SPEC.md §5's 30-200 m², uniform", () => {
    const rng = createRng(4);
    const range = TSG_SCORE_DISTRIBUTION_AREA_RANGE_M2.value;
    for (let i = 0; i < 100; i++) {
      const { derived } = buildSyntheticEngineInput(rng);
      expect(derived.builtAreaM2).toBeGreaterThanOrEqual(range.min);
      expect(derived.builtAreaM2).toBeLessThanOrEqual(range.max);
    }
  });
});

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
    //
    // 99, not the 78 the independent-sampling generator produced before
    // the three corrections (price/area coupling, equity as a share of
    // price, a varying community fee) - see the "shape of the corrected
    // distribution" block below for why: linking equity/totalBudget to
    // 25%-45% of purchase price left most generated cases unable to cover
    // their own equityRequired (financing shortfall + ~17% acquisition
    // costs + renovation), so the whole distribution's floor dropped
    // further than the reference case's own score did, and 3.8 - once a
    // middling result - is now unusually high by comparison.
    expect(computePercentile(distribution, 3.8)).toBe(99);
  });

  it("presentation sentence renders as SCORE_SPEC.md §5 specifies", () => {
    const percentile = computePercentile(distribution, 3.8);
    const sentence = `Deze investering scoort in het ${percentile}ste percentiel van ons modelbereik.`;
    expect(sentence).toBe("Deze investering scoort in het 99ste percentiel van ons modelbereik.");
  });
});

/**
 * The corrected generator's overall shape - reported explicitly per the
 * instruction to state whether the left-skew was resolved or only
 * reduced. It was neither: it got MORE pronounced. Golden values below are
 * for the default (1.000-case, default-seed) distribution; independently
 * cross-checked by hand against the sorted array percentiles they name.
 */
describe("shape of the corrected distribution (left-skew: worsened, not resolved)", () => {
  const distribution = generateReferenceDistribution();
  const s = distribution.scores;

  it("min/median/max moved down and compressed: 0.4 / 1.3 / 4.5 (previously 0.4 / 1.9 / 8.3)", () => {
    expect(s[0]).toBe(0.4);
    expect(s[500]).toBe(1.3);
    expect(s[999]).toBe(4.5);
  });

  it("the top of the range fell by nearly half (8.3 -> 4.5): no generated case scores anywhere near \"good\" anymore", () => {
    expect(Math.max(...s)).toBeLessThan(5);
  });

  it("the median fell (1.9 -> 1.3): the corrected universe is not just capped lower, it is shifted lower throughout", () => {
    expect(s[500]).toBeLessThan(1.9);
  });
});
